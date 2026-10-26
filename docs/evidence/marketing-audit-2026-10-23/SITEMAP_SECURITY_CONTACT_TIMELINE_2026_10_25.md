# Public directory, trust documents and contact refinement

Implemented locally on 25 October 2026. Presentation-only changes in the marketing runtime.

## Changes

- Public sitemap: a new transparent directory illustration, four illustrated section links, grouped directory entries and readable machine feed destinations. Counts derive from the actual collections; the previously hardcoded three-section summary now correctly reports four sections. All 37 directory links and five feed/robots links remain.
- Grievance: the numbered clause rail now retains its connecting line at mobile and desktop widths. The final clause terminates the rail. No policy copy changed.
- Security Practices: a dedicated transparent shield/data illustration, responsive hero, direct links to the existing reporting, isolation, money and authentication clauses, clearer typography and numbered clause rail. Draft notice, all eight clauses and source policy wording remain.
- Contact: response-promise and email panels now have relevant art and Lucide icons; each direct route has a different illustration. Bounded media sits above the text. Response hours still come from CONTACT_TOPICS. Form submission, validation, bot challenge, ticket lookup, destinations and mailto authority are unchanged.

## Assets and prompts

- `SITEMAP_ARTWORK_2026_10_25.json` records the built-in generation prompt and source for `apps/marketing/web/public/illustrations/sitemap-directory-studio-v1.webp` (1536 × 1024, 138,054 bytes).
- `SECURITY_CONTACT_ARTWORK_2026_10_25.json` records the built-in generation prompt and source for `apps/marketing/web/public/illustrations/support/security-data-studio-v1.webp` (1536 × 1024, 129,838 bytes).
- Both WebPs decode successfully, contain genuine alpha and have fully transparent corners. The generated security illustration was inspected as an image. Other contact images reuse existing distinct project assets.

## Exercised checks

- Marketing typecheck, CSS lint and ESLint on touched TSX: passed.
- Marketing tests: 63 passed; federation/auth boundary tests: four passed (67 total).
- Design-system hard invariants/ratchet and token-source validator: passed.
- Marketing production build: passed, including all localized static routes.
- Generated visible HTML audit, excluding script/style contents, passed for `in`, `in-hi` and `in-ta`: all 42 original sitemap destinations/labels/notes preserved; all five new sitemap anchor targets exist; security preserves 34 source strings and eight clause anchors; grievance preserves 26 source strings and six anchors. Contact form/ticket targets exist and three distinct direct-route illustrations render. All ten referenced local illustrations decode successfully.
- Legal content authority, ContactForm and TicketLookup have no source diff from these presentation changes.
- Local dev server restarted and reports ready on port 9006.

Logs/audits: `/tmp/letbuyy-security-contact-{types,css,eslint,tests,build,ds,tokens,dev}.log`, `/tmp/letbuyy-security-contact-render-audit.json`, `/tmp/letbuyy-security-sitemap-assets.json`.

## Pending verification

Live browser inspection is unavailable because local browser use is disabled in Work settings. No claim of screenshot, computed mobile geometry, keyboard, zoom or live form-submission verification is made. Responsive rules and rendered artifact preservation were checked independently. No production deployment or policy/security-behavior certification was performed.
