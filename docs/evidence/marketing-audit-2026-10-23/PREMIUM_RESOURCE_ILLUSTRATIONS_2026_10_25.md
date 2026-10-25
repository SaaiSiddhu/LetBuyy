# Premium resource illustrations — 25 October 2026

## Follow-up: missing Marketplace illustration

Reproduced in the owner's mobile preview: the Marketplace image was visible but remained `complete=false`, `currentSrc=''`, `naturalWidth=0` under the lazy Next image path. Changing only lazy loading to eager did not recover that existing request. Theme previews now eagerly load the already optimized WebP files directly (`unoptimized` on the local Next Image component). The existing preview immediately recovered, all three distinct themes and the editor reuse reported loaded, and a fresh page visit confirmed every preview loaded. No overflow at the affected viewport. Targeted component ESLint and diff whitespace checks pass. Screenshot: `missing-theme-image-fixed-mobile.jpg`. Other resource artwork loading behavior is unchanged.

Owner requested generated premium storefront imagery, real illustrations in the modular-section cards, and content-specific artwork for the three recommended guides and their destination pages.

Implemented with ten separate built-in ImageGen calls (no API/CLI fallback): three storefront studies, four modular-section scenes, and covers for Liquid themes, first-store setup, and app integrations. Hero/editor storefronts now reuse the new theme artwork. The three destination guides and recommendation cards share their respective cover. Original article data and body text were not edited. Mobile theme cards now place the complete artwork above the text, preserving readability rather than squeezing a site illustration beside the copy.

All ten generated PNGs were inspected and retained at their original generated-image paths. Optimized, alpha-preserving WebP copies are stored in `apps/marketing/web/public/illustrations/resources/`, each 1536 × 1024, approximately 165–270 KB (2,034,760 bytes total). Exact filenames, source paths, generation mode, complete final prompts and metadata are in `PREMIUM_RESOURCE_ARTWORK_2026_10_25.json` beside this record. Browser artwork is labelled concept illustration where appropriate and does not claim to be an active purchasable template or integration.

Verification:

- Production build: exit 0, `/tmp/letbuyy-premium-art-final-build.log`. Final caption-containment CSS refinement was additionally stylelint-checked and browser-verified.
- Marketing typecheck and CSS stylelint: exit 0. Targeted ESLint: no errors; one existing unused `getDifficultyLabel` warning in the shared article route.
- Existing tests: 4 federation + 56 marketing tests passed, no failures; `/tmp/letbuyy-premium-art-tests.log`.
- Browser: theme guide has no horizontal overflow at 320, 390 and 1280 widths. All four modular images loaded; no failed completed resource images. Final DOM geometry confirms all four image bounds end before their captions, including at mobile width.
- Three destination pages were opened and inspected at 390px: each has its correct loaded cover, retained body headings (Liquid: 5, first store: 8, apps: 3), and no horizontal overflow. Recommendation links still navigate to their matching guides.
- Screenshots in this directory: `premium-theme-types-desktop.jpg`, `premium-theme-types-mobile.jpg`, `premium-modular-sections-desktop.jpg`, `premium-recommended-guides.jpg`, and the three `premium-*-guide-mobile.jpg` files.
- Required governance: 110 pass, 4 fail, 1 not applicable. Same existing route-ownership, legacy-site-type, sequential-migration, and foundation-sql-policy-residue failures; `/tmp/letbuyy-premium-art-governance.log`.

Correction to earlier preview diagnostics: this run established that `scripts/governance/validator-orchestrator.mjs`'s generated-artifact cleanup removes runtime `node_modules` and `.next` directories. The governance log explicitly records removal of `apps/marketing/web/.next` and its dependency links. This accounts for preview interruption during this run; earlier notes recorded the missing folders without identifying this mechanism. After the gate finished, locked dependencies were restored with lifecycle scripts disabled, the build ran without concurrent cleanup, and only the marketing preview was restarted on its existing port 9006. No dependency versions or manifests were intentionally changed. The marketing preview is running; temporary browser tabs were closed and viewport overrides reset. Nothing was pushed or deployed.
