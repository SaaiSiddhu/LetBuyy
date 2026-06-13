# Mobile-First Guidelines

LetBuyy merchants and shoppers are overwhelmingly on phones (India-first). Design for ~360px first, enhance up.

- **Base viewport 360px** — single-column by default; `md:`/`lg:` add columns.
- **Tap targets ≥ 44px** — buttons, rows, checkboxes (`min-h-11`).
- **Thumb reach** — primary actions reachable at the bottom on long pages (`SaveBar` pins actions).
- **No horizontal scroll** — tables become stacked cards or scroll within a container at small widths.
- **Performance** — lazy-load below-the-fold; modern image formats (avif/webp, configured in `next.config`); avoid heavy client bundles (server components by default).
- **Forms** — correct input `type`/`inputmode` (numeric for amounts/pincodes), large fields, inline validation.
- **Network resilience** — optimistic where safe; clear retry on failure (`Banner` + retry).

Test at 360 / 414 / 768 / 1280. The storefront proxy + Next image config already optimize delivery.
