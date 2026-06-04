# LetBuyy UI Polish Audit

Generated: 2026-06-03

Scope: shared UI tokens, shared Storybook documentation, merchant control-plane shell hierarchy, and merchant dashboard setup presentation. No backend logic, API contracts, database schema, payment logic, auth logic, or data-fetching behavior was changed.

## Current Findings

| Area | Before | Change Applied | Status |
|---|---|---|---|
| Layout hierarchy | Light sidebar and page canvas could both resolve close to white. | Added explicit sidebar, page, and card layers through shared tokens: sidebar `#EFEFF1`, page `#F5F5F7`, card `#FFFFFF`. | Improved |
| Dark hierarchy | Dark sidebar/page/card hierarchy was not fully separated. | Added dark sidebar `#111827`, page `#0A0F1A`, card `#1F2937`. | Improved |
| Card system | Shared cards used 8-12px radius and heavier shadows in places. | Shared card component token now uses 16px radius and `0 1px 2px rgb(0 0 0 / 4%)`. | Improved |
| Button system | Primary CTA tokens existed but motion and hover ladder needed polish. | Light primary CTA remains dark navy, hover is `#1E293B`; dark primary CTA remains Purple V1. Buttons now use 150ms ease-out transform/color transitions. | Improved |
| Sidebar | Merchant sidebar used local white background and purple active surface. | Sidebar now consumes shared sidebar tokens, with subtle active background and no selected-item shadow. Settings is separated as its own section. | Improved |
| Spacing | Shared UI had a partial spacing scale. | Added official 4, 8, 12, 16, 24, 32, 48, 64 scale and documented it in Storybook. | Improved |
| Typography | Shared UI had display/heading/body/caption only. | Added V2 scale: display 48, H1 40, H2 32, H3 24, H4 20, body large 18, body 16, small 14, caption 12. | Improved |
| Empty states | Shared empty state was icon-only. | Added reusable illustration-driven empty-state system with required packs. | Improved |
| Onboarding | Dashboard setup list lacked a stronger narrative hero. | Added setup welcome/progress hero using existing checklist data. | Improved |

## Token Residuals

- Merchant app globals still contain some legacy local CSS rules outside the shell/sidebar/dashboard path. Many were mechanically normalized for weight, radius, and small text size, but a complete page-by-page spacing rewrite would be a separate larger migration.
- Purple `rgba(139, 92, 246, 0.08)` remains in several merchant CSS sections as an accent/selected-state color. This is allowed under Purple V1 usage.
- Semantic colors remain preserved: success, warning, danger, and info were not remapped to brand.

## Screenshot Evidence

Before screenshots:

- `.tmp/screenshots/ui-polish-wave/before/dashboard.png`
- `.tmp/screenshots/ui-polish-wave/before/products.png`
- `.tmp/screenshots/ui-polish-wave/before/orders.png`
- `.tmp/screenshots/ui-polish-wave/before/settings.png`

After screenshots:

- `.tmp/screenshots/ui-polish-wave/after/dashboard.png`
- `.tmp/screenshots/ui-polish-wave/after/products.png`
- `.tmp/screenshots/ui-polish-wave/after/orders.png`
- `.tmp/screenshots/ui-polish-wave/after/settings.png`
- `.tmp/screenshots/ui-polish-wave/after/sidebar.png`
- `.tmp/screenshots/ui-polish-wave/after/spacing.png`
- `.tmp/screenshots/ui-polish-wave/after/typography.png`
- `.tmp/screenshots/ui-polish-wave/after/empty-states.png`
- `.tmp/screenshots/ui-polish-wave/after/onboarding.png`

## Audit Verdict

LetBuyy now has a stronger token-driven admin surface hierarchy: grey canvas, white cards, quiet borders, restrained motion, navy primary CTAs in light mode, purple primary CTAs in dark mode, and purple as an accent rather than a page-fill color.
