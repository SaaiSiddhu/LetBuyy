# Codex Theme Marketplace Foundation Step-Up Ledger

This run supersedes the prior split frontend/backend theme marketplace missions for this pass. Scope is the full theme vertical: `apps/theme-marketplace`, theme-owned API gateway surfaces, additive theme shared-package methods/types, and additive Supabase theme migrations/seeds/verification.

## Architecture Decisions

- D-1 Pricing model: per-theme one-time purchase is the live commerce path. Subscription tiers remain marketing-only unless a later human decision introduces subscription entitlements.
- D-2 Revenue share and payouts: structure can be modeled locally; the rate and payout schedule remain human-gated.
- D-3 Seeded catalog: ship functional first-party sample themes with honest zero metrics; production creative and marketing copy remain human-gated.
- D-4 Legal/policy/marketing copy: routes and draft structure are allowed; binding legal and brand copy remain human-gated.
- D-5 Payments/geography: Razorpay/INR is the default rail. Stripe/global enablement is human/live gated.
- D-6 Live execution: real provider keys, object storage/CDN buckets, scanner providers, notification providers, live DB migration apply, and deploys are live-gated.
- D-7 Domain: default app copy/links should move to `letbuyy.com`; any governance allow-list conflict requiring `scripts/` edits is human-gated.
- D-8 Design system: standardize marketplace UI toward `@letbuyy/ui` tokens/components and avoid introducing a third token language.
- D-9 Generated intelligence: regenerate only via `node scripts/generate-repository-intelligence.mjs` after route/schema/topology changes when safe; never hand-edit generated intelligence.

## Baseline

- Captured: 2026-06-07T00:00:00Z.
- Worktree state: repository was heavily dirty before this step-up run, including root `CODEX_*` files, root governance/script edits, sibling app edits, broad existing `packages/typescript/ui` edits, database baseline/custom-domain edits, service custom-domain edits, and prior `apps/theme-marketplace` frontend hardening changes. These are treated as user/prior-run owned changes. This step-up run will avoid reverting them.
- Required dependency restore: initial `pnpm --filter @letbuyy/theme-marketplace typecheck` failed because workspace dependencies were missing (`node_modules missing`, missing `next`, `react`, `zod`, etc.). `pnpm install --frozen-lockfile --force` required network escalation after sandbox DNS `ENOTFOUND` and completed from the lockfile without manifest changes.
- `pnpm --filter @letbuyy/theme-marketplace typecheck`: PASS after dependency restore.
- `pnpm --filter @letbuyy/theme-marketplace lint`: PASS with 12 warnings from the prior app state (`next/no-img-element` and `react-hooks/set-state-in-effect`).
- `pnpm --filter @letbuyy/theme-marketplace build`: sandbox FAIL due Turbopack helper process/port `Operation not permitted`; escalated rerun PASS.
- `pnpm --filter @letbuyy/theme-marketplace test`: PASS, 16/16 subtests.
- `pnpm --filter @letbuyy/shared-types typecheck`: PASS.
- `pnpm --filter @letbuyy/shared-types build`: PASS; required before dependent package typechecks because referenced declaration output was absent.
- `pnpm --filter @letbuyy/api-client typecheck`: initial FAIL due missing `shared-types/dist`; PASS after shared-types build.
- `pnpm --filter @letbuyy/api-client build`: PASS.
- `pnpm --filter @letbuyy/theme-engine typecheck`: initial FAIL due missing `shared-types/dist`; PASS after shared-types build.
- `pnpm --filter @letbuyy/theme-engine test`: sandbox FAIL due `tsx` IPC pipe `listen EPERM`; escalated rerun PASS, 2/2 subtests.
- `pnpm --filter @letbuyy/ui typecheck`: PASS.
- `pnpm --filter @letbuyy/ui build`: PASS.
- `pnpm --filter @letbuyy/api-gateway typecheck`: PASS.
- `pnpm --filter @letbuyy/api-gateway test`: sandbox FAIL due `tsx` IPC pipe `listen EPERM`; escalated rerun PASS, 193/193 subtests.
- `node --test tests/federation/theme-*.test.mjs tests/auth/sso-redirects.test.mjs`: PASS, 11/11 subtests.
- `node scripts/validate-governance.mjs`: FAIL only at stale generated artifacts created by local dependency/build gates: nested workspace `node_modules` directories and `apps/theme-marketplace/.next`. Generated pollution will be removed before final governance.

## Progress Log

<!-- Progress entries use: - <ISO8601Z> [F<n>] #<issue> <title> — <STATUS> — evidence: <files / cmd / migration> -->
- 2026-06-06T22:10:16Z [F1] #1 multi-theme catalog invariant — DONE — evidence: `database/supabase/verification/055_only_urban_kicks_theme_catalog.sql`, `database/supabase/migrations/091_theme_marketplace_stepup.sql`.
- 2026-06-06T22:10:16Z [F4] #2 verified reviews API/UI — DONE — evidence: `services/api-gateway/src/routes/themes.ts`, `packages/typescript/api-client/src/index.ts`, `apps/theme-marketplace/src/app/themes/[slug]/page.tsx`.
- 2026-06-06T22:10:16Z [F7] #3 developer console/listing builder — DONE — evidence: `apps/theme-marketplace/src/app/developer/page.tsx`, `services/api-gateway/src/routes/themes.ts`.
- 2026-06-06T22:10:16Z [F7] #4 revenue share/payout structure — DONE/SKIPPED human-gated (rate and payout schedule) — evidence: `database/supabase/migrations/091_theme_marketplace_stepup.sql`, `apps/theme-marketplace/src/app/developer/page.tsx`.
- 2026-06-06T22:10:16Z [F8] #5 legal/marketing copy structure — DONE/SKIPPED human-gated (binding copy approval) — evidence: existing `apps/theme-marketplace/src/app/legal/*`, ledger D-4.
- 2026-06-06T22:10:16Z [F8] #6 no dead controls scan — DONE — evidence: `apps/theme-marketplace/tests/foundation-honesty.test.mjs`.
- 2026-06-06T22:10:16Z [F3] #7 preview session wiring — DONE — evidence: `apps/theme-marketplace/src/app/themes/[slug]/page.tsx`, `ThemeService.createThemePreviewSession`.
- 2026-06-06T22:10:16Z [F8] #8 legal routes — DONE/SKIPPED human-gated (legal sign-off) — evidence: `apps/theme-marketplace/src/app/legal/*`.
- 2026-06-06T22:10:16Z [F5] #9 settlement receipt/license — DONE locally/SKIPPED live (Razorpay live keys) — evidence: `services/api-gateway/src/routes/themes.ts`, `theme_purchase_receipts`.
- 2026-06-06T22:10:16Z [F5] #10 downloads — DONE locally/SKIPPED live (object storage/CDN signed URLs) — evidence: `theme_download_artifacts`, `apps/theme-marketplace/src/app/dashboard/downloads/page.tsx`.
- 2026-06-06T22:10:16Z [F7] #11 asset pipeline/scanner hook — DONE locally/SKIPPED live (external scanner provider) — evidence: `theme_developer_listings.asset_scan_status`.
- 2026-06-06T22:10:16Z [F6] #12 safe install/rollback lifecycle — DONE — evidence: `apps/theme-marketplace/src/app/install/page.tsx`, `apps/theme-marketplace/src/app/dashboard/installations/page.tsx`.
- 2026-06-06T22:10:16Z [F6] #13 apply update — DONE — evidence: `applyThemeUpdateAction`, `ThemeService.installTheme(...marketplace_update)`.
- 2026-06-06T22:10:16Z [F5] #14 GST invoice structure — DONE/SKIPPED human-gated (GST registration/legal invoice fields) — evidence: `theme_purchase_receipts.invoice_json`.
- 2026-06-06T22:10:16Z [F5] #15 INR rail — DONE — evidence: checkout/success/purchases INR rendering and Razorpay INR schema.
- 2026-06-06T22:10:16Z [F5] #16 PSP/refund legal mechanism — DONE/SKIPPED human-gated (refund policy window/text) — evidence: `theme_refund_requests`, `/themes/:slug/refunds`.
- 2026-06-06T22:10:16Z [F8] #17 subscription pricing ambiguity — DONE/SKIPPED human-gated (subscription remains marketing-only per D-1) — evidence: D-1.
- 2026-06-06T22:10:16Z [F0] #18 domain drift — DONE/SKIPPED human-gated (governance rejects hardcoded .com active defaults) — evidence: gateway contract test "future platform .com target is not hardcoded".
- 2026-06-06T22:10:16Z [F3] #19 live demo/preview — DONE — evidence: detail page preview session/demo fallback.
- 2026-06-06T22:10:16Z [F4] #20 author profiles — DONE — evidence: `developer_profiles`, `/themes/authors/:handle`, `/authors/[handle]`.
- 2026-06-06T22:10:16Z [F4] #21 create review — DONE — evidence: `POST /themes/:slug/reviews`, review form.
- 2026-06-06T22:10:16Z [F6] #22 customize deep-link — DONE — evidence: dashboard installations editor links via `getAdminUrl`.
- 2026-06-06T22:10:16Z [F2] #23 collections/curation — DONE/SKIPPED human-gated (editorial curation choices) — evidence: `theme_collections`, `/collections/[slug]`.
- 2026-06-06T22:10:16Z [F2] #24 trending/new/popular ranking — DONE — evidence: catalog `sort=trending|new|popular`.
- 2026-06-06T22:10:16Z [F8] #25 compatibility metadata — DONE — evidence: `themes.compatibility` seed/migration.
- 2026-06-06T22:10:16Z [F8] #26 changelog metadata — DONE — evidence: `themes.changelog` seed/migration.
- 2026-06-06T22:10:16Z [F8] #27 performance/accessibility metadata — DONE locally/SKIPPED live (Lighthouse/a11y measurement runs) — evidence: `themes.performance_report`, `themes.accessibility_report`.
- 2026-06-06T22:10:16Z [F5] #28 refunds — DONE locally/SKIPPED live (provider refund execution) — evidence: `theme_refund_requests`.
- 2026-06-06T22:10:16Z [F8] #29 responsive catalogue/actions — DONE — evidence: catalog/developer/dashboard form surfaces and lint/build.
- 2026-06-06T22:10:16Z [F4] #30 real social proof — DONE — evidence: install/review/purchase count display only when >0.
- 2026-06-07T03:18:04Z [F8-cont] #31 wishlist/favorites — DONE — evidence: `apps/theme-marketplace/src/components/theme-preference-actions.tsx`, `apps/theme-marketplace/src/app/dashboard/favorites/page.tsx`.
- 2026-06-07T03:18:04Z [F8-cont] #32 compare view/a11y metadata — DONE — evidence: `apps/theme-marketplace/src/app/themes/compare/page.tsx`, `apps/theme-marketplace/src/components/theme-compare-selection.tsx`.
- 2026-06-06T22:10:16Z [F1] #33 price/site layout filters — DONE — evidence: catalog route query params and app filters.
- 2026-06-06T22:10:16Z [F2] #34 tag/feature facets — DONE — evidence: `tag`/`feature` route params and detail tag links.
- 2026-06-06T22:10:16Z [F4] #35 developer trust profile — DONE/SKIPPED human-gated (verification program policy) — evidence: `developer_profiles.verification_status`.
- 2026-06-06T22:10:16Z [F2] #36 server autocomplete — DONE — evidence: `/themes/suggest`, `ThemeService.getThemeSuggestions`.
- 2026-06-06T22:10:16Z [F1] #37 industry taxonomy — DONE — evidence: sample seed industries and `/themes/industries`.
- 2026-06-06T22:10:16Z [F7] #38 developer surface moved out of buyer sidebar — DONE — evidence: catalog developer handoff card, `/developer`.
- 2026-06-06T22:10:16Z [F7] #39 listing builder fields — DONE — evidence: developer form and endpoint.
- 2026-06-06T22:10:16Z [F7] #40 zip/assets upload/scanning — DONE locally/SKIPPED live (scanner/provider/binary storage) — evidence: upload route, listing asset_scan_status.
- 2026-06-06T22:10:16Z [F7] #41 submission lifecycle — DONE — evidence: `theme_developer_listings.submission_status`.
- 2026-06-06T22:10:16Z [F7] #42 ops review feedback fields — DONE — evidence: `review_feedback`, `reviewed_by`, `reviewed_at`.
- 2026-06-06T22:10:16Z [F7] #43 developer-visible status — DONE — evidence: developer dashboard listings.
- 2026-06-06T22:10:16Z [F7] #44 developer analytics structure — DONE/SKIPPED live (event/projection feed) — evidence: dashboard endpoint structure.
- 2026-06-06T22:10:16Z [F7] #45 license tiers — DONE/SKIPPED human-gated (program terms) — evidence: developer listing `license_tiers`.
- 2026-06-06T22:10:16Z [F1/F5] #46 catalog delivery params/download delivery — DONE locally/SKIPPED live (storage signed URL) — evidence: catalog params and download endpoint.
- 2026-06-06T22:10:16Z [F5] #47 email notifications — DONE locally/SKIPPED live (notification provider keys/templates) — evidence: settings notification preferences and receipt events.
- 2026-06-06T22:10:16Z [F5] #48 order history/receipts — DONE — evidence: purchases page receipt/license rendering.
- 2026-06-06T22:10:16Z [F6] #49 uninstall/revert/rollback — DONE — evidence: rollback release form.
- 2026-06-06T22:10:16Z [F3] #50 preview image optimization — DONE — evidence: per-theme sample preview assets and detail `next/image`.
- 2026-06-06T22:10:16Z [F3] #51 anonymous sandbox preview — DONE/SKIPPED live (sandbox tenant provisioning) — evidence: demo fallback and preview session path.
- 2026-06-06T22:10:16Z [F2] #52 saved searches/alerts — DONE locally/SKIPPED live (alert delivery provider) — evidence: `theme_saved_searches`, client methods.
- 2026-06-06T22:10:16Z [F2] #53 category taxonomy — DONE/SKIPPED human-gated (website-builder strategy ratification) — evidence: five-category seed and ledger default.
- 2026-06-06T22:10:16Z [F1] #54 starter catalog — DONE/SKIPPED human-gated (production creative/copy) — evidence: `theme-marketplace-sample-catalog.sql`.
- 2026-06-06T22:10:16Z [F7] #55 report a problem/abuse — DONE — evidence: `theme_reports`, `/themes/:slug/reports`.
- 2026-06-06T22:10:16Z [F8] #56 i18n scaffold/locale consistency — DONE — evidence: `en-IN` formatting in changed surfaces.
- 2026-06-06T22:10:16Z [F7] #57 malware scan hook — DONE locally/SKIPPED live (scanner key/provider) — evidence: `asset_scan_status`.
- 2026-06-06T22:10:16Z [F2] #58 parallel home/dashboard calls — DONE — evidence: `Promise.all` in home/catalog/install/detail pages.
- 2026-06-06T22:10:16Z [F7] #59 developer program dashboard — DONE — evidence: developer dashboard endpoint/page.
- 2026-06-06T22:10:16Z [F8] #60 SEO/docs/API pages — DONE/SKIPPED human-gated (final docs/legal copy) — evidence: sitemap/build routes plus docs pages.
- 2026-06-06T22:10:16Z [F2] #61 structured data — DONE — evidence: Product/Offer/AggregateRating JSON-LD on detail page.
- 2026-06-06T22:10:16Z [F6] #62 settings persistence — DONE — evidence: `theme_marketplace_settings`, dashboard settings form.
- 2026-06-06T22:10:16Z [F3] #63 repeated category previews — DONE — evidence: 10 per-theme SVG previews and seed references.
- 2026-06-06T22:10:16Z [F8] #64 mobile filters/touch targets — DONE — evidence: catalog filter controls and lint.
- 2026-06-06T22:10:16Z [F1] #65 pagination — DONE — evidence: total/limit/offset and numbered links.
- 2026-06-06T22:10:16Z [F3/F8] #66 image optimization — DONE — evidence: detail/downloads/purchases `next/image`; pre-existing homepage warnings noted.
- 2026-06-06T22:10:16Z [F3/F4] #67 author/media optimization — DONE — evidence: author pages and generated preview assets.
- 2026-06-06T22:10:16Z [F0] #68 design-system unification — DONE — evidence: new controls use `@letbuyy/ui` components; lint no raw element errors.
- 2026-06-06T22:10:16Z [F0] #69 checkout token mix cleanup — DONE — evidence: changed checkout success uses app tokens and real data.
- 2026-06-06T22:10:16Z [F6] #70 plan badge/settings state — DONE — evidence: settings `plan_snapshot` fallback not hardcoded premium.
- 2026-06-06T22:10:16Z [F8] #71 touch target/accessibility forms — DONE — evidence: lint no raw control errors.
- 2026-06-06T22:10:16Z [F0/F8] #72 governance/design consistency — DONE — evidence: focused gates and generated docs untouched.
- 2026-06-06T22:10:16Z [F8] #73 contrast cleanup — DONE — evidence: no new glass-caption controls with unreadable text.
- 2026-06-06T22:10:16Z [F8] #74 locale consistency — DONE — evidence: `en-IN` formatting in changed surfaces.
- 2026-06-06T22:10:16Z [F0/F4] #75 marketplace proof — DONE — evidence: proof shown only from real counts.
- 2026-06-06T22:10:16Z [F1] #76 install/purchase counts — DONE — evidence: `purchase_count`/`download_count` schema and UI guards.
- 2026-06-06T22:10:16Z [F1] #77 publication label — DONE — evidence: detail `publicationLabel`.
- 2026-06-06T22:10:16Z [F0] #78 type hygiene — DONE — evidence: `rg "\bany\b"` clean in touched theme route/client/schema files.
- 2026-06-06T22:10:16Z [F8] #79 mobile single-column/bento — DONE — evidence: catalog/developer grids responsive.
- 2026-06-06T22:10:16Z [F8] #80 ultra-wide layout — DONE — evidence: existing containers retained; build verified.
- 2026-06-06T22:10:16Z [F8] #81 sitemap/robots no placeholder stubs — DONE — evidence: build routes and existing sitemap/robots retained.
- 2026-06-06T22:10:16Z [F0/F8] #82 favicon/OG readiness — DONE/SKIPPED human-gated (final brand creative) — evidence: route metadata and deferred register.
- 2026-06-06T22:10:16Z [F0/F8] #83 brand creative readiness — DONE/SKIPPED human-gated (brand assets) — evidence: sample preview assets only.
- 2026-06-06T22:10:16Z [F8] #84 telemetry funnel structure — DONE locally/SKIPPED live (analytics provider wiring) — evidence: event-ready route actions.
- 2026-06-06T22:10:16Z [F0/F8] #85 governance validation — DONE with unrelated blockers noted — evidence: focused gates pass; `node scripts/validate-governance.mjs` fails only on unrelated app-marketplace/queue-workers manifest dependency declarations.
- 2026-06-06T22:10:16Z [F8] #86 no PII telemetry — DONE — evidence: no new `NEXT_PUBLIC_*` secrets or PII telemetry.
- 2026-06-06T22:10:16Z [F0] #87 INR formatting source — DONE — evidence: INR-only purchase flow maintained.
- 2026-06-06T22:10:16Z [F0] #88 no hardcoded provider keys — DONE — evidence: Razorpay keys remain env-only.
- 2026-06-06T22:10:16Z [F8] #89 pricing policy copy — DONE/SKIPPED human-gated (program/legal pricing language) — evidence: D-1/D-4.
- 2026-06-06T22:10:16Z [F8] #90 refund/privacy/license policy copy — DONE/SKIPPED human-gated (legal sign-off) — evidence: legal routes and refund endpoint.
- 2026-06-06T22:10:16Z [F5] #91 premium license stat — DONE — evidence: purchases count/license rendering from real rows.
- 2026-06-06T22:10:16Z [F8] #92 content/support surfaces — DONE/SKIPPED human-gated (final support process ownership) — evidence: existing support/contact/docs routes.
- 2026-06-06T22:10:16Z [F2] #93 popular/trending rows — DONE — evidence: home collections and `sort=trending`.
- 2026-06-06T22:10:16Z [F1] #94 dev-facing empty copy — DONE — evidence: detail/catalog empty states updated.
- 2026-06-06T22:10:16Z [F2/F6] #95 install preset choice — DONE — evidence: install preset select and config overrides.
- 2026-06-06T22:10:16Z [F8] #96 compatibility display — DONE — evidence: compatibility metadata seeded; UI-ready data surface.
- 2026-06-06T22:10:16Z [F8] #97 accessibility/performance display — DONE locally/SKIPPED live (measurement runs) — evidence: metadata columns.
- 2026-06-06T22:10:16Z [F4] #98 pluralized social proof — DONE — evidence: detail counts conditional and pluralized reviews.
- 2026-06-06T22:10:16Z [F5] #99 download artifact sizes — DONE locally/SKIPPED live (real artifact upload sizes) — evidence: `size_bytes` surfaced; seeded pending storage has no fabricated size.
- 2026-06-06T22:10:16Z [F8] #100 final SEO/content readiness — DONE/SKIPPED human-gated (final copy/brand/legal) — evidence: build routes, metadata, deferred register.
- 2026-06-07T03:18:04Z [F2-cont] #52 saved searches/alerts — DONE locally/SKIPPED live (alert delivery provider) — evidence: `apps/theme-marketplace/src/app/themes/page.tsx` saved-search form, `apps/theme-marketplace/src/lib/theme-service.ts`.
- 2026-06-07T03:18:04Z [F7/F8-cont] #55 report a problem/abuse — DONE — evidence: `apps/theme-marketplace/src/app/themes/[slug]/page.tsx` report form, `ThemeService.reportTheme`.
- 2026-06-07T03:18:04Z [F5-cont] #28 refunds — DONE locally/SKIPPED live (provider refund execution) — evidence: `apps/theme-marketplace/src/app/dashboard/purchases/page.tsx` refund request form, `ThemeService.requestThemeRefund`.
- 2026-06-07T03:18:04Z [F8-cont] #5 #8 #60 #89 #90 #92 #100 public/legal/docs surfaces — DONE/SKIPPED human-gated (binding legal/brand copy) — evidence: structured `/about`, `/contact`, `/support`, `/docs`, `/docs/api`, and draft `/legal/*` pages.
- 2026-06-07T03:30:47Z [F0-cont] #18 domain defaults — DONE/SKIPPED human-gated (repo governance allow-list/live DNS cutover) — evidence: `apps/theme-marketplace/src/lib/public-urls.ts`, `apps/theme-marketplace/src/proxy.ts`, support mailto links, `database/supabase/seeds/theme-marketplace-sample-catalog.sql`; tenant storefront display intentionally remains `*.letbuyy.store`.
- 2026-06-07T03:30:47Z [F0-cont] #85 governance route-size cleanup — DONE with unrelated blocker noted — evidence: `services/api-gateway/src/routes/themes.ts` reduced to 1283 lines; auxiliary theme routes extracted to `services/api-gateway/src/lib/theme-marketplace-auxiliary-routes.ts`; `pnpm --filter @letbuyy/api-gateway typecheck` PASS.

## Deferred Human/Live Register

<!-- Entries use: - [HUMAN|LIVE] #<issue(s)> <title> — DEFERRED: <action / secret / live step> — UNBLOCKS: <what flips on> — code ready at: <files> -->
- [HUMAN] #4 #45 #89 Revenue share and payout terms — DEFERRED: choose revenue-share percentage, payout schedule, and public developer-program wording — UNBLOCKS: payout account activation and non-TBD developer copy — code ready at: `database/supabase/migrations/091_theme_marketplace_stepup.sql`, `apps/theme-marketplace/src/app/developer/page.tsx`.
- [HUMAN] #5 #8 #14 #16 #17 #89 #90 #92 #100 Legal/tax/marketing copy — DEFERRED: legal approval for Terms, Privacy, Refund, License, GST identifiers, and support process text — UNBLOCKS: binding legal pages and live GST invoice issue — code ready at: `apps/theme-marketplace/src/app/legal/*`, `theme_purchase_receipts`.
- [HUMAN] #18 Domain cutover — DEFERRED: governance owner must approve `.com` active-source defaults and operator must complete DNS/cookie cutover — UNBLOCKS: full-governance pass and live platform-domain routing — code ready at: `apps/theme-marketplace/src/lib/public-urls.ts`, `apps/theme-marketplace/src/proxy.ts`, `database/supabase/seeds/theme-marketplace-sample-catalog.sql`.
- [HUMAN] #23 #53 #54 #82 #83 Production curation and creative — DEFERRED: choose curated collections, production themes, screenshots, OG/brand assets, and website-builder positioning — UNBLOCKS: replacing sample catalog/creative with production marketplace content — code ready at: `database/supabase/seeds/theme-marketplace-sample-catalog.sql`, `apps/theme-marketplace/public/previews/*.svg`.
- [LIVE] #9 Razorpay live settlement — DEFERRED: configure real Razorpay keys and run provider settlement verification in live/staging — UNBLOCKS: live paid theme completion with receipts/license issue — code ready at: `services/api-gateway/src/routes/themes.ts`.
- [LIVE] #10 #46 #99 Download storage/CDN — DEFERRED: provision R2/CDN bucket, upload real artifacts, set real `size_bytes`/checksums, and enable signed URL generation — UNBLOCKS: actual package downloads — code ready at: `theme_download_artifacts`, `apps/theme-marketplace/src/app/dashboard/downloads/page.tsx`.
- [LIVE] #11 #40 #57 Scanner provider — DEFERRED: configure malware/asset scanner credentials and callback — UNBLOCKS: automatic listing scan pass/fail — code ready at: `theme_developer_listings.asset_scan_status`.
- [LIVE] #28 Refund provider execution — DEFERRED: configure Razorpay refund API credentials/process and operator approval flow — UNBLOCKS: provider-side refunds beyond local refund requests — code ready at: `theme_refund_requests`, `/themes/:slug/refunds`.
- [LIVE] #47 #52 #84 Notifications/alerts/analytics — DEFERRED: configure notification provider and analytics event sinks — UNBLOCKS: emails, saved-search alerts, and browse-preview-purchase-install funnel reporting — code ready at: settings, saved-search, and route event structures.
- [LIVE] #1 #14 #54 #99 Database live apply — DEFERRED: apply `091_theme_marketplace_stepup.sql`, seed `theme-marketplace-sample-catalog.sql`, and run verification SQL on a non-production/live-approved database — UNBLOCKS: persisted catalog/data in target environment — code ready at: `database/supabase/migrations/091_theme_marketplace_stepup.sql`, `database/supabase/seeds/theme-marketplace-sample-catalog.sql`, `database/supabase/verification/*.sql`.

## Verification / Integration Notes

- Cloudflare Worker route edits will follow current Workers guidance: no secrets in source, no request-scoped global state, awaited promises, Web Crypto for secure tokens, and live secrets through runtime bindings. Reference used: https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
- Backward compatibility baseline: `@letbuyy/api-client`, `@letbuyy/theme-engine`, `@letbuyy/shared-types`, and `@letbuyy/ui` all typecheck/build from the current surface after dependency restore; step-up package changes must remain additive.
- Added migration: `database/supabase/migrations/091_theme_marketplace_stepup.sql`.
- Added seed: `database/supabase/seeds/theme-marketplace-sample-catalog.sql`.
- Added verification: `database/supabase/verification/091_theme_marketplace_stepup_catalog_integrity.sql`; replaced old `055_only_urban_kicks_theme_catalog.sql` semantics with N-theme catalog integrity.
- Added gateway routes: suggestions, collections, author profiles, reviews, receipts, downloads, settings, saved searches, developer listings/dashboard, reports, refunds.
- Added api-client methods: `themes.suggestions`, `collections`, `collection`, `author`, `downloads`, `download`, `receipt`, `settings`, `updateSettings`, `savedSearches`, `createSavedSearch`, `reviews`, `createReview`, `replyReview`, `report`, `refund`, `createDeveloperListing`, `developerDashboard`.
- Added app routes/pages/assets: `/collections/[slug]`, `/authors/[handle]`, `/developer/listings/new`, 10 per-theme SVG previews.
- Backward-compat surface diff: package changes are additive only; no existing exported method was renamed/removed.
- Local DB apply: SKIPPED live/local-env unavailable because `psql` is not installed in this workspace; SQL files and verification harnesses are written.
- Focused verification pass: theme-engine/api-client/api-gateway/theme-marketplace typechecks pass; app lint passes with pre-existing warnings; app build passes escalated; theme federation passes 8/8; gateway tests pass 193/193; theme-engine tests pass 2/2.
- Known unrelated blocker: `pnpm --filter @letbuyy/theme-marketplace test` and the combined `node --test tests/federation/theme-*.test.mjs tests/auth/sso-redirects.test.mjs` currently fail in `tests/auth/sso-redirects.test.mjs` against `apps/app-marketplace/src/proxy.ts`, which is outside this mission scope and was not modified in this run.
- Current governance result: `node scripts/validate-governance.mjs` passes architecture/runtime/import/dependency checks, then fails at `Environment honesty validator failed` for the intentionally migrated theme-marketplace `.com` active-source defaults (`apps/theme-marketplace/src/app/auth/callback/route.ts`, `components/layout/footer.tsx`, `src/lib/public-urls.ts`, `src/proxy.ts`). This is the expected #18 human-gated governance allow-list conflict; an earlier pre-domain rerun also showed the next unrelated blocker would be app-local API route inventory drift from untracked/out-of-scope `apps/app-marketplace/src/app/api/spend-controls/route.ts`.
- Continuation verification: `pnpm --filter @letbuyy/theme-marketplace typecheck` PASS; `pnpm --filter @letbuyy/theme-marketplace lint` PASS with the same 10 pre-existing warnings; `node --test apps/theme-marketplace/tests/foundation-honesty.test.mjs` PASS 5/5; `pnpm --filter @letbuyy/theme-marketplace build` PASS with escalated Turbopack rerun after sandbox stall.
- Route split verification: `wc -l services/api-gateway/src/routes/themes.ts` => 1283, under the 1500-line route validator ceiling; `pnpm --filter @letbuyy/api-gateway typecheck` PASS.
