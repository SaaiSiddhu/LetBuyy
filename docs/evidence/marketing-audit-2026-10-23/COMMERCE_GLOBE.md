# Commerce globe — 2026-10-23, completed 2026-10-24 IST

Current placement (owner correction, 2026-10-24): the rotating globe now occupies the hero's former Commerce OS illustration slot. The original CommerceNetwork illustration has moved intact to the globe's previous position above the final CTA. Existing hero/CTA copy, links and section order remain. The hero shows a compact activity summary and always-available playback control; expanding the summary reveals all existing journey content, location selectors and controls, and pauses playback. The earlier final-CTA globe placement described in the initial implementation is superseded.

Placement verification: marketing build, typecheck and lint/stylelint passed; the five globe unit tests passed. Browser confirmed one globe in the hero, no globe in the final CTA, the original network illustration in the final CTA, ready map data, working activity disclosure/playback, and no horizontal overflow in the inspected viewport. The development preview was restarted after the build invalidated its generated styles. [Current hero screenshot](globe-hero-placement.png).

## Direction and geography

Visually studied Cloudflare's [Region: Earth globe](https://www.cloudflare.com/): dotted continents, spherical rotation, location markers and adjacent callouts. The LetBuyy implementation uses original Canvas code, the existing brand tokens, Lucide UI icons and native HTML controls. No Cloudflare source code or artwork was copied.

Starts with Chennai, Tamil Nadu, then Bengaluru, Hyderabad, New Delhi, Mumbai, Srinagar (Jammu & Kashmir), Shanghai (China), Singapore, London, New York and Sydney. Curved geographic connections originate in Tamil Nadu. The camera turns toward each location and activity cards describe a store being created/built or an order being placed. The entire sequence is explicitly illustrative, with no fabricated live customer identities, telemetry or market-availability claims.

Land dots are derived from public-domain [Natural Earth land geometry](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson). [Terms](https://www.naturalearthdata.com/about/terms-of-use/) permit modification and commercial use. [Provenance, source hash and derivation](globe-geography-provenance.json) record the 6,363-point local asset (105,288 bytes; 40,199 bytes gzipped). It is loaded once near the viewport; no third-party map or tracking service is called.

## Behavior

- Auto progression, pause/resume, previous/next, direct destination selection and return to Tamil Nadu. Reset restores the globe position and keyboard focus through the existing smooth-scroll utility.
- Stops continuous rendering/progression when offscreen or the document is hidden. The renderer is capped at approximately 30fps and device pixel ratio 2; trigonometric camera values are calculated once per frame.
- Reduced-motion preference disables automatic movement/progression while preserving manual controls. Preference behavior was source-inspected, not browser-emulated.
- The canvas is decorative; activity, place names and controls remain accessible HTML. Automatic activity updates are not repeatedly announced; paused/manual changes use a polite live region.
- Theme-aware colors, fixed scene aspect ratio, 44px controls and mobile stacking. Failed map loading retains location controls and exposes a retry action; this failure path was source-inspected, not network-fault-injected.
- Direct `#commerce-globe` links account for the existing homepage smooth-scroll controller and entrance transition.

## Verification

- Production build: pass, 494 generated pages.
- ESLint/stylelint: pass, zero errors and the same 19 pre-existing warnings.
- Typecheck: pass after the build completed.
- Tests: 15/15 (4 existing federation tests, 6 existing marketing tests, 5 new globe tests). New tests cover required journey order, projection/hemisphere occlusion, geographic arc endpoints/lift, date-line travel, degenerate routes and bounded non-negative animation timing.
- Browser: inspected 320px mobile and 1440px desktop layouts, light/dark themes, loaded land geometry, automatic progression, pause stability, requested Srinagar/Shanghai selection, keyboard activation, reset focus and offscreen progression stopping. No horizontal document overflow in those checks.
- Fixed resize/theme repaint clock reversal and protected color resolution during stylesheet changes. No new browser errors after the final correction during subsequent checks; earlier development errors are retained in browser history.
- SHA-256 comparison: Header, Hero, CommerceNetwork, CapabilityMap, Features, MerchantJourney, EcosystemMap, Pricing and FAQ unchanged from task start. FinalCTA changes only the visual import and instance. Existing stylesheet content is preserved with scoped globe rules appended.
- Network preview page and local map asset each returned HTTP 200 at `192.168.1.18:9006`.

The later browser preview had a user display scale of approximately 229%; CSS viewport dimensions were read separately from screenshot dimensions. Screenshots are visual evidence, not a full accessibility or device performance certification. The saved [China route screenshot](globe-china-desktop.png) shows the globe, connecting arc, selection controls and preserved CTA. No production deployment was performed.

## Entry points

- `apps/marketing/web/src/components/CommerceGlobe.tsx`
- `apps/marketing/web/src/components/CommerceGlobeCanvas.tsx`
- `apps/marketing/web/src/lib/commerce-globe.ts`
- `apps/marketing/web/public/maps/earth-land-dots-v1.json`
- `tests/marketing/commerce-globe.test.ts`

Preview: `http://localhost:9006/in#commerce-globe` or same-Wi-Fi `http://192.168.1.18:9006/in#commerce-globe`.
