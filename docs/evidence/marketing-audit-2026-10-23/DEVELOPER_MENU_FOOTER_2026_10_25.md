# Developer artwork, platform cards and grey footer — 25 October 2026

## Requests and changes

1. Replace the repeated developer recommendation image. API, webhook and custom-integration guides now have distinct generated subjects: authenticated access to product records, signed event delivery, and bridges between business records. The existing shared artwork registry updates their covers, recommendations, category/search listings and selected section scenes. A coverage test requires distinct full and thumbnail artwork across all five developer guides.
2. Keep background artwork and icons on the two platform cards in the mobile menu. `Header` retains its original Sparkles/LayoutDashboard icons, localized titles/descriptions and panel-opening actions. Each card now has decorative background artwork in its upper portion, reusing the inspected brand illustration and build-store scene. Copy occupies an opaque lower surface; the arrow has a small surface behind it for legibility. Styles are scoped to the two featured cards in `header-featured-art.module.css`.
3. Make the footer lightly grey. The light-theme footer uses the canonical neutral grey-150 surface with a grey-300 top border. Supporting links/text use grey-600 for contrast. Existing footer content, navigation and privacy behavior remain. The explicit supporting-text/background pair measures 6.58:1; this is a source-color measurement, not rendered-page certification.

## Verification

- Marketing TypeScript, CSS lint, targeted ESLint and final production build passed.
- 63 marketing tests and four federation boundary tests passed.
- Design-system and single-token-source validators passed.
- Three new 1536 × 1024 transparent WebPs and 480px thumbnails are local to the app. Full images are 99–161 KB; thumbnails are 18–25 KB. Alpha metadata audit passed. `DEVELOPER_DISTINCT_ARTWORK_2026_10_25.json` records prompts, original generation outputs and app paths.
- Production HTML for the custom-integrations guide was checked in all three locale routes. Every recommendation group contains three distinct, decodable local images: API, webhooks and the existing app-development artwork.
- Browser observation remains unavailable: CUA returned “Local browser use is disabled in Work settings.” Live mobile-menu opening, responsive composition, footer appearance and screenshot proof remain unverified; no alternate automation was used to bypass the setting.
- Localhost was restarted after the final build. No article prose, release data, backend, dependencies or topology changed.

Sources: `src/lib/resources/artwork.ts`, `src/lib/resources/section-visuals.ts`, `src/components/Header.tsx`, `src/components/header-featured-art.module.css`, the bounded footer additions in `src/app/globals.css`, and `tests/marketing/reading-visuals.test.ts`.

Evidence: `/tmp/letbuyy-developer-menu-build.log`, `/tmp/letbuyy-developer-menu-tests.log`, `/tmp/letbuyy-developer-menu-eslint.log`, `/tmp/letbuyy-developer-menu-css.log`, `/tmp/letbuyy-developer-art-alpha.json`, `/tmp/letbuyy-developer-art-html-audit.json`, `/tmp/letbuyy-footer-grey-contrast.json`.
