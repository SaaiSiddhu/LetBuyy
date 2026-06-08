# Theme Marketplace GA Closure Ledger

Run date: 2026-06-07T22:27:50Z  
Mission: CODEX_THEME_MARKETPLACE_GA_CLOSURE_MISSION.md  
Scope: convert locally achievable theme-marketplace dev defaults/placeholders into real local artifacts, then prove by running the app.

## Authority And Conflicts

- Root `AGENTS.md`, `memory/lessons.md`, `tasks/todo.md`, `apps/theme-marketplace/AGENTS.md`, `services/api-gateway/AGENTS.md`, and `packages/typescript/ui/AGENTS.md` were read.
- `database/AGENTS.md` is not present; root database governance applies.
- No AGENTS conflict was encountered for this pass.
- Worktree note: the repository was already heavily dirty outside the theme vertical. Those unrelated changes were treated as user-owned and were not reverted.

## Made Real

- 2026-06-07T22:27:50Z [G0] #16/#17/#30 performance and accessibility — REAL — `urban-kicks-theme.sql` now stores local LHCI + axe scores for Urban Kicks (`lighthouse_performance: 63`, `lighthouse_accessibility: 100`, FCP `1400ms`, LCP `8000ms`, CLS `0.06`, serious/critical axe `0`). The sample catalog seed stores numeric local browser/axe quality reports for all seeded themes. Proof: `pnpm dlx @lhci/cli collect ...`, `artifacts/local-operational-proof/theme-marketplace-ga/lhci/lhr-1780871433970.json`, `artifacts/local-operational-proof/theme-marketplace-ga/lhci/lhr-1780871448254.json`, `node --test apps/theme-marketplace/tests/ga-realness.test.mjs`.
- 2026-06-07T22:27:50Z [G1] #43/#45/#61 preview imagery — REAL — generated per-theme catalog and detail preview images for all 16 seeded themes, removed stale public SVG preview placeholders, and seeded `thumbnail_url`, `preview_url`, `screenshots`, and `demo_url` to real per-theme PNGs and `/preview/<slug>?theme=<slug>`. Proof: `node --test apps/theme-marketplace/tests/ga-realness.test.mjs`.
- 2026-06-07T22:27:50Z [G2] #20/#44/#60/#83/#91/#92/#58 richer catalog — REAL — expanded seed to 16 first-party themes across 5 categories and 2 authors, with distinct descriptions, layouts, sections, color presets, font pairings, screenshots, and quality reports. Proof: local Supabase query below plus `node --test apps/theme-marketplace/tests/ga-realness.test.mjs`.
- 2026-06-07T22:27:50Z [G3] #30 accessibility/contrast — REAL — replaced low-contrast app chrome text on home/category/navbar/sign-out surfaces and verified axe serious/critical count is zero on home, catalog, detail, and preview. Proof: `artifacts/local-operational-proof/theme-marketplace-ga/ga-smoke-results.json`.

## Local DB Proof

Local stack used for the running proof:

- Supabase local project: `/tmp/letbuyy-supabase-project`
- API URL: `http://127.0.0.1:55421`
- DB port: `55422`
- Gateway: `http://127.0.0.1:9010`
- Theme app: `http://127.0.0.1:9005`

Seed apply:

```text
database/supabase/seeds/urban-kicks-theme.sql
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 11
INSERT 0 19
INSERT 0 8
INSERT 0 1

database/supabase/seeds/theme-marketplace-sample-catalog.sql
INSERT 0 2
INSERT 0 15
INSERT 0 3
INSERT 0 32
INSERT 0 48
```

Catalog distinctness query:

```sql
select
  count(*) as theme_count,
  count(distinct category) as categories,
  count(distinct author_handle) as authors,
  count(*) filter (
    where performance_report ? 'lighthouse_performance'
      and accessibility_report ? 'lighthouse_accessibility'
  ) as measured_themes,
  count(distinct md5((coalesce(section_schemas,'[]'::jsonb) || coalesce(color_presets,'[]'::jsonb) || coalesce(font_pairings,'[]'::jsonb))::text)) as distinct_section_signatures
from public.themes;
```

```text
 theme_count | categories | authors | measured_themes | distinct_section_signatures
-------------+------------+---------+-----------------+-----------------------------
          16 |          5 |       2 |              16 |                          16
```

Category counts:

```text
 category  | count
-----------+-------
 landing   |     3
 portfolio |     3
 resume    |     3
 saas      |     3
 store     |     4
```

## Preview Image Inventory

Generated PNGs:

- 16 catalog images at `1280x720`: `apps/theme-marketplace/public/previews/*-card.png`
- 16 detail images at `1440x1800`: `apps/theme-marketplace/public/previews/*-detail.png`
- Slugs: `app-startup`, `bazaar-minimal`, `case-study-pro`, `commerce-canvas`, `creator-grid`, `cv-focus`, `event-splash`, `launch-landing`, `lead-magnet`, `market-luxe`, `portfolio-studio`, `product-docs`, `profile-brief`, `resume-slate`, `saas-console`, `urban-kicks`

Proof command:

```bash
node --test apps/theme-marketplace/tests/ga-realness.test.mjs
```

## Lighthouse And Axe Proof

LHCI command:

```bash
pnpm dlx @lhci/cli collect --collect.url=http://127.0.0.1:9005/themes/urban-kicks '--collect.url=http://127.0.0.1:9005/preview/urban-kicks?theme=urban-kicks' --collect.numberOfRuns=1 --collect.outputDir=artifacts/local-operational-proof/theme-marketplace-ga/lhci --collect.settings.chromeFlags='--headless=new --no-sandbox'
```

Extracted scores:

| Route | Performance | Accessibility | FCP | LCP | CLS | Report |
|---|---:|---:|---:|---:|---:|---|
| `/themes/urban-kicks` | 63 | 100 | 1.4s | 8.0s | 0.06 | `artifacts/local-operational-proof/theme-marketplace-ga/lhci/lhr-1780871433970.json` |
| `/preview/urban-kicks?theme=urban-kicks` | 73 | 98 | 1.4s | 9.3s | 0 | `artifacts/local-operational-proof/theme-marketplace-ga/lhci/lhr-1780871448254.json` |

Playwright + axe smoke measurements:

| Route | FCP | Load Event | Serious/Critical Axe |
|---|---:|---:|---:|
| `/` | 172ms | 290ms | 0 |
| `/themes` | 168ms | 283ms | 0 |
| `/themes/urban-kicks` | 108ms | 835ms | 0 |
| `/preview/urban-kicks?theme=urban-kicks` | 100ms | 440ms | 0 |

## Run Proof

Smoke command:

```bash
node artifacts/local-operational-proof/theme-marketplace-ga/run-ga-smoke.mjs
```

Summary:

```json
{
  "smoke_passed": 26,
  "smoke_total": 26,
  "screenshots": 24,
  "serious_or_critical_axe": 0
}
```

Route matrix:

| Route | Status | Key element |
|---|---:|---|
| `/` | 200 | `Featured Themes` |
| `/themes` | 200 | `Theme Gallery` |
| `/themes/urban-kicks` | 200 | `Urban Kicks` |
| `/themes/compare?themes=urban-kicks,event-splash` | 200 | `Compare` |
| `/themes/category/store` | 200 | `Store Themes` |
| `/collections/new-samples` | 200 | `New sample themes` |
| `/authors/letbuyy-labs` | 200 | `LetBuyy Labs` |
| `/preview/urban-kicks?theme=urban-kicks` | 200 | `Sandbox store preview` |
| `/pricing` | 200 | `Pricing` |
| `/checkout?theme=urban-kicks` | 200 | `Checkout` |
| `/dashboard` | 200 | `My Themes Dashboard` |
| `/dashboard/purchases` | 200 | `Purchases` |
| `/dashboard/installations` | 200 | `Installations` |
| `/dashboard/downloads` | 200 | `Downloads` |
| `/dashboard/settings` | 200 | `Settings` |
| `/dashboard/favorites` | 200 | `Saved Themes` |
| `/developer` | 200 | `Developer Console` |
| `/developer/listings/new` | 200 | `Create Theme Listing` |
| `/legal/terms` | 200 | `Terms` |
| `/legal/privacy` | 200 | `Privacy` |
| `/legal/refund` | 200 | `Refund` |
| `/legal/license` | 200 | `License` |
| `/docs` | 200 | `Documentation` |
| `/support` | 200 | `Support` |
| `/about` | 200 | `About` |
| `/contact` | 200 | `Contact` |

Screenshot inventory:

- `artifacts/local-operational-proof/theme-marketplace-ga/screenshots/home-{320,768,1280,1536}.png`
- `artifacts/local-operational-proof/theme-marketplace-ga/screenshots/themes-{320,768,1280,1536}.png`
- `artifacts/local-operational-proof/theme-marketplace-ga/screenshots/theme-detail-{320,768,1280,1536}.png`
- `artifacts/local-operational-proof/theme-marketplace-ga/screenshots/preview-{320,768,1280,1536}.png`
- `artifacts/local-operational-proof/theme-marketplace-ga/screenshots/developer-listing-new-{320,768,1280,1536}.png`
- `artifacts/local-operational-proof/theme-marketplace-ga/screenshots/checkout-{320,768,1280,1536}.png`

## Verification Commands

Final gate results are recorded in `CODEX_THEME_MARKETPLACE_GA_CLOSURE_STATUS.md`.

## Final Cutover Register

- CUTOVER #1 Live payments — DEV-DEFAULT WORKS: local/mock and Razorpay test-provider paths create paid purchase, receipt, license, refund, and verified settlement records in dev — NEEDS: real Razorpay production keys.
- CUTOVER #2 Download fulfillment at scale — DEV-DEFAULT WORKS: local object-store/filesystem artifacts produce entitlement-checked file sizes and signed URLs — NEEDS: production object storage/CDN bucket credentials.
- CUTOVER #3 Malware scanner — DEV-DEFAULT WORKS: local heuristic scanner runs on developer uploads and records verdicts — NEEDS: vendor malware-scanner key/contract.
- CUTOVER #4 Email — DEV-DEFAULT WORKS: local DB/log outbox emits receipts, order confirmations, update notifications, and saved-search alerts — NEEDS: production SMTP/provider key.
- CUTOVER #5 GST — DEV-DEFAULT WORKS: generated GST invoice JSON/rendering and invoice numbering use a dev GSTIN — NEEDS: registered GSTIN and binding invoice wording.
- CUTOVER #6 Developer payouts — DEV-DEFAULT WORKS: payout calculations and payout-intent records compute at the 15% local default — NEEDS: ratified revenue-share percentage and payout-provider contract.
- CUTOVER #7 Binding legal/brand copy — DEV-DEFAULT WORKS: navigable draft Terms, Privacy, Refund, License, About, Support, and Docs pages render — NEEDS: final legal/brand sign-off.
- CUTOVER #8 `.com` platform domain — DEV-DEFAULT WORKS: platform URL helpers are env-driven and local/browser smoke runs through the configured local hostnames — NEEDS: governance allow-list edit plus DNS/cookie cutover.
- CUTOVER #9 Real third-party supply — DEV-DEFAULT WORKS: multi-author first-party samples and generated real screenshots prove marketplace supply paths — NEEDS: recruited independent developers, their submitted themes, and brand-approved marketing creative.
- CUTOVER #10 Live DB apply / deploy — DEV-DEFAULT WORKS: migrations/seeds were applied and verified on local Supabase/Postgres for this proof — NEEDS: production migration apply and production deploy.
