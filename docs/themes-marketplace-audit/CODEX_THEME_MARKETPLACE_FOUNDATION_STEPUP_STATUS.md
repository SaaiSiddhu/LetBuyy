# Codex Theme Marketplace Foundation Step-Up Status

This status file tracks the full-vertical step-up run that supersedes the earlier split frontend/backend theme marketplace missions for this pass.

## Current State

- Phase: F0-F8 implementation pass complete for this step-up run.
- Continuation pass: local wishlist/favorites, compare, saved-search form, report form, refund-request form, `.com` platform defaults, structured public/docs/legal draft pages, and gateway route-size cleanup implemented after the initial handoff.
- Scope guard: edits stayed in the theme vertical, additive shared package contracts, theme database migration/seed/verification, theme federation test coverage, and step-up docs.
- Terminal coverage: issues #1-#100 have ledger lines with `DONE`, `DONE locally/SKIPPED live`, or `DONE/SKIPPED human-gated`; #31 and #32 are now fully `DONE` instead of human-skipped.
- This run supersedes the prior parallel frontend/backend theme marketplace missions for this pass.
- Local DB apply: not run because `psql` is unavailable in this workspace; migration, seed, and verification SQL are written for operator/local DB execution.
- Known unrelated blocker: the bundled auth SSO test currently fails against `apps/app-marketplace/src/proxy.ts`, outside this mission scope. Theme-specific tests pass.
- Known governance blocker: `node scripts/validate-governance.mjs` currently fails at environment honesty for the intentionally migrated `.com` theme-marketplace defaults (`auth/callback`, footer support email, public URL defaults, proxy). This is the expected #18 human-gated allow-list conflict. A pre-domain rerun also showed the next unrelated blocker would be app-local API route inventory drift from untracked/out-of-scope `apps/app-marketplace/src/app/api/spend-controls/route.ts`.

## Phase Counts

| Phase | DONE | SKIPPED-live | SKIPPED-human |
|---|---:|---:|---:|
| F0 Foundation | 5 | 0 | 1 |
| F1 Catalog data | 8 | 1 | 1 |
| F2 Discovery | 8 | 1 | 2 |
| F3 Try-before-buy | 4 | 1 | 0 |
| F4 Trust layer | 7 | 0 | 1 |
| F5 Commerce truth | 7 | 5 | 4 |
| F6 Safe lifecycle | 7 | 0 | 0 |
| F7 Developer program | 9 | 4 | 4 |
| F8 Polish/SEO/telemetry | 20 | 4 | 8 |

Counts include issues where the reversible in-code part is done and the ledger records a live/human deferment for the gated portion.

## Final Gate Output

- `pnpm --filter @letbuyy/theme-marketplace typecheck`: PASS.
- `pnpm --filter @letbuyy/theme-marketplace lint`: PASS with 10 pre-existing warnings (`next/no-img-element`, `react-hooks/set-state-in-effect`).
- `pnpm --filter @letbuyy/theme-marketplace build`: PASS after escalated rerun; sandboxed build was stopped after a long Turbopack compile stall.
- `node --test apps/theme-marketplace/tests/foundation-honesty.test.mjs`: PASS, 5/5.
- `node --test tests/federation/theme-*.test.mjs`: PASS, 8/8.
- `pnpm --filter @letbuyy/theme-engine typecheck`: PASS.
- `pnpm --filter @letbuyy/theme-engine test`: PASS with escalation for `tsx` IPC, 2/2.
- `pnpm --filter @letbuyy/api-client typecheck`: PASS.
- `pnpm --filter @letbuyy/api-client build`: PASS.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `pnpm --filter @letbuyy/api-gateway test`: PASS with escalation for `tsx` IPC, 193/193.
- `pnpm --filter @letbuyy/shared-types typecheck`: PASS.
- `pnpm --filter @letbuyy/ui typecheck`: PASS.
- `pnpm --filter @letbuyy/ui build`: PASS.
- `pnpm --filter @letbuyy/theme-marketplace test`: FAIL in unrelated `tests/auth/sso-redirects.test.mjs` against `apps/app-marketplace/src/proxy.ts`; theme subtests passed.
- `node --test tests/federation/theme-*.test.mjs tests/auth/sso-redirects.test.mjs`: FAIL in the same unrelated app-marketplace auth proxy assertion; theme federation passed.
- `node scripts/validate-governance.mjs`: FAIL at environment honesty for the expected #18 `.com` active-source default conflict in theme-marketplace; architecture/runtime/import/dependency checks passed first. Pre-domain rerun also exposed unrelated app-local API inventory drift (`expected 115, found 116`) caused by out-of-scope `apps/app-marketplace/src/app/api/spend-controls/route.ts`.
- `psql --version`: unavailable, so SQL apply/verification was not executed in this workspace.
- Continuation `pnpm --filter @letbuyy/theme-marketplace typecheck`: PASS.
- Continuation `pnpm --filter @letbuyy/theme-marketplace lint`: PASS with the same 10 pre-existing warnings.
- Continuation `node --test apps/theme-marketplace/tests/foundation-honesty.test.mjs`: PASS, 5/5.
- Continuation `pnpm --filter @letbuyy/theme-marketplace build`: PASS after escalated rerun; sandboxed Turbopack compile stalled and was stopped.
- Continuation `pnpm --filter @letbuyy/api-gateway typecheck`: PASS after route split.
- Continuation `wc -l services/api-gateway/src/routes/themes.ts`: 1283 lines, under the 1500-line governance ceiling.

## Operator Go-Live Summary

- Apply `database/supabase/migrations/091_theme_marketplace_stepup.sql` to the target database, then run `database/supabase/seeds/theme-marketplace-sample-catalog.sql` and both theme verification harnesses.
- Configure Razorpay keys and run live/staging purchase verification before enabling paid live traffic.
- Provision artifact storage/CDN, upload real bundles, store real sizes/checksums in `theme_download_artifacts`, and enable signed URL generation.
- Configure malware/asset scanner credentials and wire listing scan callbacks.
- Approve final legal/privacy/refund/license/GST/support copy and GST registration values.
- Choose revenue-share percentage and payout schedule; configure payout provider after program approval.
- Approve the `.com` active-source defaults and complete DNS/cookie cutover before live platform-domain routing; theme marketplace defaults now point platform/support links to `letbuyy.com`, while tenant storefront hosts remain `*.letbuyy.store`.
- Replace sample catalog/preview assets with approved production creative once brand/content owners provide it.
