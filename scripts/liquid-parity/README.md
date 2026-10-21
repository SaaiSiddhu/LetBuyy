# Liquid Parity Scripts — Document 6

Snapshot capture, comparison, and parity-matrix runner for Phase E.0 of the LetBuyy Launch Readiness Program.

## Overview

These scripts prove parity between the React render path (current default) and the Liquid render path across all 20 frozen sections × 10 dimensions. They run against the staging storefront and write evidence to `LAUNCH_READINESS_2026_06_12/evidence/e-liquid-parity/`.

## Prerequisites

```sh
export STAGING_STOREFRONT_BASE_URL=https://staging.letbuyy.com
export STAGING_TEST_SUBDOMAIN=<test-merchant-subdomain>
# Optional: comma-separated section keys to scope a run
export PARITY_SECTION_FILTER=hero,product-grid
```

The staging storefront must have two parallel test stores:
- **React store**: `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` (current default)
- **Liquid store**: per-store flag override enabling the Liquid path

Set `STAGING_LIQUID_SUBDOMAIN` to the Liquid-enabled test store if it differs from `STAGING_TEST_SUBDOMAIN`.

## Scripts

### `capture-snapshot.mjs`

Fetches the storefront page for a test store and saves the section HTML + head metadata.

```sh
node scripts/liquid-parity/capture-snapshot.mjs \
  --section hero \
  --subdomain my-test-store \
  --engine react \
  --viewport desktop
```

Options:
- `--section` — section type key (e.g. `hero`, `product-grid`)
- `--subdomain` — test store subdomain
- `--engine react|liquid` — which render engine (used for output directory naming)
- `--viewport desktop|mobile` — User-Agent and width hint
- `--out-dir` — override output directory (default: `evidence/e-liquid-parity/snapshots/`)
- `--mode body|head|both` — capture section body HTML, head metadata, or both (default: `both`)

### `compare-snapshots.mjs`

Structural HTML diff between a React snapshot and a Liquid snapshot.

```sh
node scripts/liquid-parity/compare-snapshots.mjs \
  --section hero \
  --viewport desktop
```

Reads from `evidence/e-liquid-parity/snapshots/react/` vs `liquid/` and writes diffs to `evidence/e-liquid-parity/snapshots/diff/`.

### `run-parity-matrix.mjs`

Runs all 20 sections × 2 engines × 2 viewports and reports pass/fail per cell.

```sh
node scripts/liquid-parity/run-parity-matrix.mjs          # all 20 sections
node scripts/liquid-parity/run-parity-matrix.mjs hero     # specific section
```

Updates `LAUNCH_READINESS_2026_06_12/evidence/e-liquid-parity/PARITY_MATRIX.md` with pass/fail results.

## Parity Thresholds

| Dimension | Threshold | Tool |
|-----------|-----------|------|
| Rendering | Structural HTML match (attributes ignored: `data-*`, inline styles that are cosmetic) | `compare-snapshots.mjs` |
| SEO/meta | `<title>`, `<meta name="description">`, `og:*`, `<link rel="canonical">` identical | `compare-snapshots.mjs --mode head` |
| Performance | p95 server-render latency ≤ React p95 × 1.25 | `X-Lb-Render-Engine` header + Document 4 dashboard |

## Phase E Exit Gate G-E1

All 200 cells (20 sections × 10 dimensions) must be ✅ PASS before advancing to canary C2.
Evidence row is appended to `EXECUTION_LEDGER.md` by the human running Phase E.0.

## First-party catalog distribution

`build-first-party-catalog.mjs` generates migration 372 and its illustrative thumbnails from the existing preset registry. Check reproducibility with:

```sh
node --import tsx scripts/liquid-parity/build-first-party-catalog.mjs --check
```

The database catalog remains the runtime authority. Do not rewrite an applied migration when adding future catalog releases; introduce a new forward migration. The ten new identities explicitly choose the existing Liquid renderer; existing themes and the global default are preserved.
