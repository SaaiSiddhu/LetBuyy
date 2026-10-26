# Support, CTA and platform visual refinement — 25 October 2026

## Requested and implemented

- Capability map nodes: replaced the glossy shortcut bitmaps with the existing Lucide family, including Bot for AI and Users for Customers. The same shared symbol renderer is used by nodes, panel headers and accordion headers. Node labels, accent colors, selection, keyboard behavior and connections remain. Related AI module chips also use Bot through the existing capability metadata.
- Final CTA: removed the `CommerceNetwork` import/render and replaced it with a new storefront-launch illustration. Home and pricing use the same bounded image composition. The signup and demo destinations and original CTA copy remain. Reduced-motion visitors skip the CTA reveal offsets. The unused network source file is retained; it is no longer rendered by the CTA.
- Platform Surfaces: added four distinct illustrative shortcut assets for Themes, Apps, Developers and Pricing, as explicitly requested. These are decorative bitmap shortcuts beside real HTML labels, badges and links. Functional arrows remain Lucide. A two-row card layout gives titles/descriptions room alongside the artwork.
- Grievance: added a dedicated case-folder illustration, clearer hero/metadata hierarchy, source-section and support links, and scoped typography/spacing refinements. The draft status banner, officer placeholders, all six clauses, summaries, timelines, addresses and source policy text remain.
- Contact: added a conversation illustration, a two-column header with a stacked mobile layout, clearer form heading and direct anchors for the form and ticket lookup. The existing `ContactForm`, `TicketLookup`, topic catalog, response times, Turnstile and API handling were not changed. No form or ticket request was submitted during this work.
- Support: the checkout had no standalone marketing support route, so `/[locale]/support` now provides guide links, contact and grievance routes, account lookup, and the canonical `TicketLookup` component. Footer, human sitemap and XML sitemap make it discoverable. No parallel ticket system or backend was introduced.

Eight new assets use the established graphite, ivory, violet and sage editorial language. All have real alpha and are stored as WebP in the app. The four shortcut files are 512 × 512 (22–30 KB each); the four larger scenes are 1536 × 1024 (128–161 KB each). Generation prompts, original paths and app asset paths are in `SUPPORT_CTA_SURFACE_ASSETS_2026_10_25.json`.

## Verification

- Marketing TypeScript, CSS lint and production build passed.
- Targeted ESLint: no errors; one pre-existing unused `ConnectedModules` warning in `CapabilityMap.tsx`.
- Existing tests: 63 marketing + four federation boundary tests passed.
- Design-system and single-token-source validators passed. Marketing is separately covered by stylelint.
- Alpha metadata audit passed for all eight new assets.
- Production output audit covered home, grievance, contact and support in all three locale routes. It confirmed all 26 grievance source strings and all six clause IDs, the existing draft/pending-officer disclosures, both new contact anchors, and the support page. Every locale home contains the new CTA asset without the old CTA network, all four surface shortcut images, and no old AI/Customers shortcut bitmap references. All 30 directly referenced local editorial files in the audited pages decode.
- Live browser/keyboard/responsive visual verification is pending: CUA returned “Local browser use is disabled in Work settings.” No alternative browser automation bypassed that setting. No live screenshot proof or external form-success claim is made.
- Localhost restarted after the build and reports ready on port 9006.

## Evidence and scope

Logs: `/tmp/letbuyy-support-cta-build.log`, `/tmp/letbuyy-support-cta-tests.log`, `/tmp/letbuyy-support-cta-eslint.log`, `/tmp/letbuyy-support-cta-css.log`, `/tmp/letbuyy-support-cta-assets-audit.json`, `/tmp/letbuyy-support-cta-render-audit.json`.

Key sources: `src/components/CapabilityArtwork.tsx`, `CapabilityMap.tsx`, `FinalCTA.tsx`, `final-cta.module.css`, `EcosystemMap.tsx`, `platform-surfaces.module.css`, `src/components/support/*`, `src/app/[locale]/support/page.tsx`, `contact/page.tsx`, `legal/[slug]/page.tsx` and the sitemap/footer discoverability additions.

This is presentation and routing work. No legal policy content, officer/entity facts, form payloads, authentication, schema, money flows, dependencies or deployment topology changed. Existing unrelated worktree changes remain intact. Full repository governance was not rerun; previously recorded unrelated gate failures remain outside this scope.
