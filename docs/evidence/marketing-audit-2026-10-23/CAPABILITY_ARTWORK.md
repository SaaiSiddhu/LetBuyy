# Capability shortcut illustrations — 2026-10-23

Replaced the eight outline icons in the capability navigation and mobile accordion with a coordinated set of dimensional transparent illustrations. Orders uses a cobalt shopping bag; Inventory an amber carton; Storefronts a teal shop; Payments an emerald wallet; Customers paired sculptural figures; Analytics violet chart columns; AI a lavender orbital star; B2B a blue warehouse.

The latest user request specifically authorizes changing these shortcut tiles. All copy, badges, feature lists, navigation handlers, module ordering, and dashboard previews remain. Commerce OS graphs and diagrams retain their existing Lucide icons and design.

## Source and rendering

- Generated with the built-in `image_gen` tool; alpha-transparent RGBA PNGs, 1254 × 1254 each. Originals retained.
- Orders was the style reference for the remaining seven assets. No Commerce OS diagram was supplied to image generation.
- Repository assets: `apps/marketing/web/public/illustrations/capabilities/*-v1.png`.
- [Exact prompts, original paths, and destination mapping](capability-artwork-provenance.json).
- `CapabilityArtwork.tsx` renders decorative Next Image assets with empty alt text, lazy loading, fixed square dimensions, and a 48px responsive slot. Real button labels remain accessible. Browser selected optimized 96px images for the 48px slots.

## Verification

- Marketing lint and stylelint passed, with the same 19 pre-existing ESLint warnings and no errors.
- Typecheck passed. Existing marketing test suites: 10/10 passed.
- Production build passed: 494 pages generated.
- Browser checked at 320px, 346px, 490px, and 1440px. No horizontal page overflow; all eight images decoded; Orders and Inventory selection updated the expected panel and expanded/pressed state.
- [Protection proof](capability-artwork-protection.json): Hero, CommerceNetwork, MerchantJourney, Features, and EcosystemMap unchanged by hash. Every CapabilityMap top-level declaration except NavItem and AccordionItem unchanged. Existing stylesheet is an identical prefix; new rules target shortcut art only.
- Screenshots: [mobile 320px](capability-art-mobile-320.png), [mobile preview](capability-art-mobile.png), [desktop](capability-art-desktop.png).

The earlier whole-file CapabilityMap protection record is narrowed only for the two shortcut rendering functions explicitly requested in this update. No Commerce OS diagram code or existing diagram CSS changed.
