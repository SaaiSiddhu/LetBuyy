# Capability illustrations, footer removal and lookup spacing

Owner requests on 25 October 2026: use proper illustrative capability icons; remove the footer Android app promotion; separate the ticket validation alert from the Check status button.

## Implemented

- CapabilityArtwork now supplies eight transparent 256px WebPs to existing labeled graph nodes, panel headings and accordion controls. Six reuse the established capability family; AI and Customers are newly generated processor/chat and profile-card illustrations. Functional Lucide controls and navigation/selection behavior remain. Graph artwork fits within the existing 60px inset, and panel icon space is explicitly reserved.
- All eight delivery assets are under `apps/marketing/web/public/illustrations/capabilities/icons/*-v2.webp`, total 111,210 bytes. Real alpha verified for every file. `CAPABILITY_ICON_ASSETS_2026_10_25.json` records paths, source reuse, prompts, generation mode and intended role. Both newly generated sources were visually inspected before encoding.
- Removed the shared footer's entire Merchant app for Android block, both available/pending badge branches, launch note, unused download resolver import and badge-only CSS. Footer navigation, brand mark, language and privacy controls remain.
- Ticket lookup body is now a normal-flow grid with a token-based gap between its fields/button and error/result. Field spacing is consistent, the action reserves a minimum 48px height and alert/result margins are reset locally. Validation copy, alert semantics, lookup data contract and submission logic remain unchanged.
- Previously requested growth promotional banner is absent; the five-stage Merchant Journey is retained.

## Verification

- Marketing typecheck and CSS lint passed.
- ESLint has no errors in touched components. Footer retains two existing raw-img warnings for privacy controls; CapabilityMap retains an existing unused ConnectedModules warning from a separately checked file. Those unrelated elements were not rewritten.
- All 67 existing marketing/federation tests passed.
- Design-system and token-source validators passed.
- Marketing production build passed.
- Generated HTML audit: all eight capability assets referenced on each localized homepage; growth banner ID absent and merchant-journey ID present. App-promotion copy absent from all 162 generated footers per locale (`in`, `in-hi`, `in-ta`).
- Local dev server restarted on port 9006.

Evidence: `/tmp/letbuyy-capability-footer-{types,eslint,css,tests,build,ds,token,dev}.log`, `/tmp/letbuyy-capability-footer-render-audit.json`, `/tmp/letbuyy-capability-icon-assets.json`.

Live browser inspection remains unavailable because browser access is disabled in Work settings. Mobile computed geometry, interactive validation-state screenshots and keyboard/screen-reader behavior have not been newly verified. CSS normal-flow separation and build artifacts were checked independently; no production deployment was made.
