# Three regressions of this programme's own, found by the full gate (APPID-FIX1, 2026-09-24)

APPID-P4d ran `gate.sh --full` for the first time in this programme and compared it, by failure name,
with the same gate on a clean `develop` worktree. Three failures turned out to be regressions left by
earlier phases of this programme, invisible to the `--security` gates those phases ran, because
`--security` does not run each runtime's own test script. Branch `letbuyy/appid-fix1-full-gate-regressions`
(`c94f1e7a` examples, `13fee87d` paths). Gate results are in the phase's `EXECUTION_LEDGER.md` row.

| Failure | Where it runs | Introduced by | Measured | Fix |
|---|---|---|---|---|
| "K5/contract-doc: contract doc names all three frozen apps" | customer-web's test script (`tests/launch/lb-k-theme-platform.test.mjs`) | APPID-P1: the test moved to `apps/frozen/*`, the contract document it reads kept the old paths | customer-web failed 4 before APPID-P1 (`ab3ac8e3`) and 5 after | `THEME_PLATFORM_CONTRACT.md` names `apps/frozen/{theme-store,app-store,developer-portal}`, with the former paths noted |
| "marketplace robots and sitemaps derive canonical URLs from the request host" | marketing-site's test script | APPID-P1: the test still read `apps/app-marketplace` and `apps/theme-marketplace` | 4 of 4 before APPID-P1, 3 of 4 after | the test reads `apps/frozen/{app-store,theme-store}` |
| eight "theme-examples: … byte-identical to live …" | theme-engine's own tests | APPID-P4c: `theme-bundle.ts` gained the Liquid login section's "Continue with LetBuyy" link, and the examples were not regenerated | 1861 of 1861 before APPID-P4c (`33eba8a9`), 1853 after | `generate-examples.mjs` only: the section text, its checksum and size, both content hashes, the index timestamp |

## Evidence

| Claim | Check | Result |
|---|---|---|
| Each fix clears its failure | marketing-site test script; `lb-k-theme-platform.test.mjs`; theme-engine tests | 4 of 4; 55 of 55; 1861 of 1861 |
| Nothing else in those scripts changed | customer-web test script | 938 of 942, the four failures it had before APPID-P1, by name |
| Each fix is what clears it | plants: the document back to the old paths, the test back to the old directories, one example bundle back to the stale file | each fails its test |

## Not in scope

customer-web's four older failures ("F5 fallback_reason is conditioned on both liquidHtml===null AND
plan.rendererEngine===liquid", "Liquid storefront plans bind catalog data and cart drops without
fabricating server cart state", "storefront resolver and composition engine render full Liquid
documents with Liquid chrome", `tests/localization/theme-localization.test.mjs`) and merchant-web's
37 predate this programme; they are recorded, not changed.
