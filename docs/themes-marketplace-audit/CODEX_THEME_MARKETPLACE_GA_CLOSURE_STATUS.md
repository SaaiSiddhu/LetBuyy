# Theme Marketplace GA Closure Status

Run date: 2026-06-07T22:27:50Z  
Ledger: `docs/themes-marketplace-audit/CODEX_THEME_MARKETPLACE_GA_CLOSURE_LEDGER.md`  
Status: GA closure complete locally; remaining work is the named operational cutover set.

## Workstream Counts

| Workstream | Status | Proof |
|---|---|---|
| G0 real perf/a11y numbers | REAL | LHCI reports + axe smoke + seeded numeric quality reports |
| G1 real preview imagery | REAL | 32 generated per-theme PNGs + GA realness test |
| G2 richer multi-author catalog | REAL | Local Supabase query: 16 themes, 5 categories, 2 authors, 16 measured themes, 16 distinct signatures |
| G3 contrast/a11y finalize | REAL | Axe serious/critical count `0` on home/catalog/detail/preview |
| G4 run/screenshot proof | REAL | 26/26 smoke routes 200 + 24 screenshots at 320/768/1280/1536 |

## Running Proof Summary

Smoke:

```json
{
  "smoke_passed": 26,
  "smoke_total": 26,
  "screenshots": 24,
  "serious_or_critical_axe": 0
}
```

Screenshot proof directory:

```text
artifacts/local-operational-proof/theme-marketplace-ga/screenshots/
```

LHCI proof:

| Route | Performance | Accessibility | FCP | LCP | CLS |
|---|---:|---:|---:|---:|---:|
| `/themes/urban-kicks` | 63 | 100 | 1.4s | 8.0s | 0.06 |
| `/preview/urban-kicks?theme=urban-kicks` | 73 | 98 | 1.4s | 9.3s | 0 |

Local Supabase proof:

```text
theme_count=16
categories=5
authors=2
measured_themes=16
distinct_section_signatures=16
category counts: landing=3, portfolio=3, resume=3, saas=3, store=4
verification/055_only_urban_kicks_theme_catalog.sql: DO
verification/091_theme_marketplace_stepup_catalog_integrity.sql: DO
```

## Verification Gates

| Gate | Result |
|---|---|
| `pnpm --filter @letbuyy/theme-marketplace typecheck` | PASS |
| `pnpm --filter @letbuyy/theme-marketplace lint` | PASS, 0 errors, 122 warnings from existing token/raw-control governance rules |
| `pnpm --filter @letbuyy/theme-marketplace test` | PASS after sandbox escalation for `tsx` IPC; first sandboxed run failed with `EPERM` on `/var/folders/.../tsx-501/*.pipe` |
| `node --test apps/theme-marketplace/tests/foundation-honesty.test.mjs` | PASS, 8/8 |
| `node --test apps/theme-marketplace/tests/ga-realness.test.mjs` | PASS, 3/3 |
| `pnpm --filter @letbuyy/theme-marketplace build` | TURBOPACK STALL; terminated after roughly 2 minutes in `Creating an optimized production build ...` |
| `pnpm --filter @letbuyy/theme-marketplace exec next build --webpack` | PASS; compiled in 6.7s and generated 30 app routes |
| `pnpm --filter @letbuyy/ui typecheck` | PASS |
| `pnpm --filter @letbuyy/ui build` | PASS |
| `pnpm --filter @letbuyy/api-client typecheck` | PASS |
| `pnpm --filter @letbuyy/api-gateway typecheck` | PASS |
| `pnpm --filter @letbuyy/api-gateway test` | PASS after sandbox escalation for `tsx` IPC; 53 unit tests + 194 contract tests passed |
| `node --test tests/federation/theme-*.test.mjs tests/auth/sso-redirects.test.mjs` | PASS, 12/12 |
| Local DB apply + verification harnesses | PASS on local Supabase DB |
| LHCI + axe + screenshot smoke | PASS; reports/screenshots saved under ignored local proof directory |
| `node scripts/validate-governance.mjs` | PASS; 172 validators passed |

## Notes

- The default Next build path still stalls under Turbopack in this workspace. The same app builds successfully with the official `--webpack` build flag. This is recorded as a reproducible build-mode note, not an app compile failure.
- `pnpm --filter ... test` commands that use `tsx` require execution outside the sandbox because `tsx` creates a local IPC pipe under `/var/folders/...`; the escalated reruns passed.
- The local proof stack was stopped after the run. The temporary Supabase proof project and direct Postgres container were removed/stopped; unrelated pre-existing Docker containers were left alone.
- Proof artifacts live under `artifacts/local-operational-proof/theme-marketplace-ga/`, which is ignored by the repo.
- This status supersedes the local-achievable dev-default portions of the V2 and UI/UX completion ledgers for GA closure. Those earlier ledgers still describe the broader feature implementation history.

## Final Operator Cutover List

Only these items remain for a human/operator:

1. Live payments: real Razorpay production keys.
2. Download fulfillment at scale: production object storage/CDN credentials.
3. Malware scanner: vendor scanner key/contract.
4. Email: production SMTP/provider key.
5. GST: registered GSTIN and binding invoice wording.
6. Developer payouts: ratified revenue-share percentage and payout-provider contract.
7. Binding legal/brand copy: final legal and brand sign-off.
8. `.com` platform domain: governance allow-list edit plus DNS/cookie cutover.
9. Real third-party supply: recruited developers, their themes, and brand-approved marketing creative.
10. Live DB apply/deploy: production migration apply and production deployment.
