# LetBuyy Apps Marketplace Foundation V2 Status

## Current Rollup

- Date: 2026-06-07 (Asia/Kolkata)
- Mission state: Waves 0-11 are implemented in code/docs for marketplace truth cleanup, money path, app versioning/edit/re-review, developer consent/approval, real submission checks, static security scan, media upload wiring, screenshot requirements, OAuth install, extension configuration, embedded launch, public developer profiles, scope review/revocation, post-install onboarding, DB-backed discovery taxonomy, honest first-party demo seed catalog, collections, featured inventory, recommendations, compare, search pagination/filtering, discovery analytics ingest, Built-for-LetBuyy-backed trust signals, developer review replies, abuse reporting, moderation actions, data-handling disclosure, app conflicts, partner directory, review policy source, app activity/event history, support SLA, works-with metadata, basic review fraud controls, developer analytics charts, persistent collaborator codes, webhook CRUD, API usage metrics, partner tiers, sandbox-store requests, demo sessions, telemetry event storage, dedicated app OAuth brute-force limits, per-app/install API quotas, real customer/shop lifecycle compliance webhook triggers, additive legacy marketplace RLS/site-column convergence, search-vector backed marketplace search fallback, queue-backed marketplace analytics sink, durable app lifecycle webhook delivery rows, production media CDN fail-closed wiring, fluid type tokens, accessible breadcrumbs, JavaScript screenshot lightbox, caption-gated demo video rendering, i18n message coverage, currency-aware listing display, request-an-app demand capture, saved apps, recently viewed apps, category SEO guidance, new-this-week editorial rail, data-driven bundle inventory, verified-install review proof rows, developer docs routes, repository docs scaffold, runbooks, and governance/audit reconciliation; completion remains partial where local migration apply, real launch-partner onboarding, live payout/media/security-vendor credentials, KYC policy, final legal wording, public docs hosting, direct-token install retirement, periodic Built-for re-check scheduling, active health polling, staged rollout enforcement, sandbox-store infrastructure provisioning, production migration apply, cloud queue/media provisioning, multi-region rollout, human-provided translations, formal browser a11y/dark-mode QA, multi-app bundle checkout orchestration, external review proof import, or cross-domain governance blockers remain outside the marketplace lane.
- DONE: 63 / 100
- PARTIAL: 37 / 100
- SKIPPED (HUMAN-APPROVAL): 0 issue rows / 12 human-owned subitems
- PENDING: 0 / 100
- New migrations added: `database/supabase/migrations/092_app_marketplace_pricing_policy.sql`, `database/supabase/migrations/093_app_pricing_plans.sql`, `database/supabase/migrations/094_app_billing_trials.sql`, `database/supabase/migrations/095_app_usage_metering.sql`, `database/supabase/migrations/096_app_spend_controls.sql`, `database/supabase/migrations/097_app_uninstall_feedback.sql`, `database/supabase/migrations/098_app_versions.sql`, `database/supabase/migrations/099_app_developer_consent_and_approval.sql`, `database/supabase/migrations/100_app_discovery_foundation.sql`, `database/supabase/migrations/101_app_trust_reviews_content.sql`, `database/supabase/migrations/102_app_developer_tooling_analytics.sql`, `database/supabase/migrations/103_app_api_quota_and_legacy_rls.sql`, `database/supabase/migrations/104_app_marketplace_scale_services.sql`, `database/supabase/migrations/105_app_marketplace_responsiveness_i18n.sql`, `database/supabase/migrations/106_app_marketplace_growth_polish.sql`.
- New tables added: `app_pricing_plans`, `app_usage_events`, `app_usage_meter_rollups`, `app_spend_controls`, `app_uninstall_feedback`, `app_versions`, `app_collections`, `app_collection_items`, `app_featured_placements`, `app_discovery_events`, `app_built_for_letbuyy_checks`, `app_review_reports`, `app_listing_reports`, `app_activity_events`, `app_review_policies`, `app_partner_analytics_daily`, `app_api_usage_metrics`, `app_collaborator_codes`, `app_partner_agency_seats`, `app_partner_tiers`, `app_sandbox_stores`, `app_demo_sessions`, `app_telemetry_events`, `app_api_quotas`, `app_requests`, `app_saved_apps`, `app_bundles`, `app_bundle_items`, `app_review_proofs` (pending real local apply due local migration-history mismatch). Wave 8 adds `marketplace_apps.search_vector` plus marketplace analytics queue indexes. Wave 9 adds `marketplace_apps.currency` and `marketplace_apps.video_captions_url`. Wave 10 adds category SEO fields on `app_categories`.
- New docs added: `docs/runbooks/app-marketplace-catalog.md`, `docs/runbooks/app-marketplace-payout-ledger.md`, `docs/runbooks/app-marketplace-review-queue.md`, `docs/runbooks/app-marketplace-incident-response.md`, `docs/apps-marketplace-developer/getting-started.md`, `docs/apps-marketplace-developer/api-reference.md`, `docs/apps-marketplace-developer/manifest-spec.md`, `docs/apps-marketplace-policies/economics.md`, `docs/apps-marketplace-policies/review-policy.md`, `docs/apps-marketplace-policies/trust-security.md`, `docs/governance/apps-marketplace-foundation-v2.md`, `docs/apps-marketplace-audit/FOUNDATION_V2_RECONCILIATION.md`.
- FOUND items closed: `FOUND-001` app-marketplace build dependency resolution.

## Dirty Worktree Note

The repository was already heavily dirty before this mission started, including modified generated intelligence, broad domain/theme work, and untracked marketplace files. Treat those changes as user-owned. This mission must use selective edits and selective staging only.

## Baseline Inventory

### Marketplace capability flags found

Source: `apps/app-marketplace/src/lib/capabilities.ts` plus the final `rg NEXT_PUBLIC_MP_` scan.

| Capability/config | Env var | Wave owner | Current mission disposition |
|---|---|---:|---|
| appTelemetry | `NEXT_PUBLIC_MP_TELEMETRY` | 6 | Wired through `recordMarketplaceEvent`, the search BFF telemetry action, `app_telemetry_events`, and the Wave 8 analytics queue helper |
| featuredRails | `NEXT_PUBLIC_MP_FEATURED_RAILS` | 4 | Wired through DB-backed `app_featured_placements`, gateway featured endpoint, API client, service method, and homepage rail |
| defaultCurrency | `NEXT_PUBLIC_MP_CURRENCY` | 9 | Currency configuration, not a capability flag; wired through currency-aware listing and pricing display with INR single-source formatting |

### Wave 0 residues found before edits

- `apps/app-marketplace/src/proxy.ts` defaults accounts URL to `https://accounts.letbuyy.store`.
- `apps/app-marketplace/src/components/Footer.tsx` links to `docs.letbuyy.store`, `letbuyy.store`, `admin.letbuyy.store`, `themes.letbuyy.store`, and `support@letbuyy.store`.
- `apps/app-marketplace/src/app/(auth)/developers/apps/new/page.tsx` shows `apps.letbuyy.store`, "pending business approval", and "contract-gated".
- `apps/app-marketplace/src/app/(auth)/developers/register/page.tsx` shows "pending business approval".
- `apps/app-marketplace/src/app/(auth)/developers/review-requirements/page.tsx` shows `SKIPPED (HUMAN-APPROVAL)`.
- `apps/app-marketplace/src/components/AppInstallConsentPanel.tsx` throws a user-visible "contract-gated" OAuth error.
- `apps/app-marketplace/src/app/(auth)/my-apps/page.tsx` uses the `🔑` emoji in a sign-in state.
- Empty BFF route dirs exist under `apps/app-marketplace/src/app/api/*`.
- `apps/app-marketplace/src/lib/experiments.ts` ignores the experiment argument.

## Last Verification Commands

Baseline and Wave 0 verification:

- `pnpm --filter @letbuyy/app-marketplace typecheck` — PASS after Wave 0
- `pnpm --filter @letbuyy/app-marketplace lint` — PASS after Wave 0
- `pnpm --filter @letbuyy/app-marketplace test` — PASS after Wave 0, 23/23 tests
- `pnpm --filter @letbuyy/app-marketplace build` — PASS after Wave 0 when rerun outside sandbox; sandbox run failed with Turbopack `Operation not permitted`
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS baseline
- `pnpm --filter @letbuyy/api-gateway build` — PASS baseline
- `pnpm --filter @letbuyy/api-gateway test` — PASS baseline when rerun outside sandbox; sandbox run failed with `tsx` IPC `EPERM`
- `pnpm --filter @letbuyy/queue-workers typecheck` — PASS baseline
- `pnpm --filter @letbuyy/queue-workers build` — PASS baseline
- `pnpm --filter @letbuyy/queue-workers test` — PASS baseline, 4/4 tests
- `pnpm --filter @letbuyy/billing-core typecheck` — PASS after dependency build output was generated; initial baseline failed on missing `@letbuyy/event-core` declaration output
- `pnpm --filter @letbuyy/billing-core build` — PASS baseline
- `pnpm --filter @letbuyy/billing-core test` — PASS baseline when rerun outside sandbox; sandbox run failed with `tsx` IPC `EPERM`
- `pnpm --filter @letbuyy/app-engine typecheck` — PASS baseline
- `pnpm --filter @letbuyy/app-engine build` — PASS baseline
- `pnpm --filter @letbuyy/app-engine test` — PASS baseline when rerun outside sandbox; sandbox run failed with `tsx` IPC `EPERM`
- `pnpm --filter @letbuyy/api-client typecheck` — PASS baseline
- `pnpm --filter @letbuyy/api-client build` — PASS baseline
- `rg -n "letbuyy\\.store|Flag: NEXT_PUBLIC|SKIPPED \\(HUMAN-APPROVAL\\)|contract-gated|pending business approval|🔑|NEXT_PUBLIC_MP_EXPERIMENTS|marketplaceExperimentEnabled|getMarketplaceCapabilityEnv" apps/app-marketplace/src` — PASS after Wave 0, no matches
- `find apps/app-marketplace/src/app/api -type d -empty -print` — PASS after Wave 0, no output
- `node scripts/validate-governance.mjs` — PARTIAL: all marketplace-relevant cleanup validators pass, but the full suite fails on pre-existing unrelated `services/api-gateway/src/routes/themes.ts` route line-count (1793 > 1500)

## Wave 0 Changes

- Centralized marketplace public host lookups through `apps/app-marketplace/src/lib/site-url.ts`.
- Removed app-marketplace source references to `letbuyy.store`.
- Replaced footer external docs links with existing marketplace routes until the W11 docs scaffold lands.
- Removed user-facing `Flag: NEXT_PUBLIC_*`, `SKIPPED (HUMAN-APPROVAL)`, `contract-gated`, and `pending business approval` copy from Wave 0 surfaces.
- Deleted the unused experiments helper and removed the `NEXT_PUBLIC_MP_EXPERIMENTS` capability entry.
- Replaced the `🔑` sign-in icon with `KeyRound` from `@letbuyy/ui`.
- Removed empty marketplace BFF route directories.
- Patched `scripts/validators/source-ledger-residue-validator.mjs` to allow the three root marketplace V2 mission artifacts required by this mission.

## Wave 1 Changes

- Set `DEFAULT_APP_REVENUE_SHARE_BPS` to `8500` in `@letbuyy/billing-core` and exposed `appRevenueSharePolicy()` as the single code source for the 85% partner share / 15% LetBuyy platform fee.
- Replaced old `8000` revenue-share fallbacks in app-store billing routes, app-store event payloads, gateway payout execution, queue-workers payout execution, shared DTO defaults, and app charge event payload defaults.
- Displayed the real revenue terms in developer registration/submission UI instead of vague marketplace commission copy.
- Canonicalized app pricing model to `free`, `freemium`, `recurring`, `one_time`, and `usage`; removed the unsupported usage-pricing UI branch.
- Added one-time billing mode support to app charge/event payload schemas and DB check constraints.
- Added sandbox payout transfer planning that advances test payouts from `pending` to `processing` to `released`, records a payout statement in ledger metadata, and emits `payout.released`.
- Preserved payout idempotency by replacing status-resetting ledger upserts with source-event lookup + insert-once + settlement transitions.
- Added FK constraints for `partner_payout_ledger_entries.charge_id` and `source_event_id` in migration `092`.
- Declared the new billing-core dependencies in app-marketplace and queue-workers package manifests, runtime manifests, and `pnpm-lock.yaml`.
- Added a My Apps paid-charge panel that creates and approves app billing charges through the existing `/api/apps/[id]/install` BFF route.
- Added Partner Console charge-status badges so developers can see pending, active, and failed charge states in billing activity.
- Added `app_pricing_plans` as an additive forward migration with developer-owner RLS, active/default constraints, and `update_updated_at()`.
- Added shared pricing-plan DTOs, API client plan CRUD methods, billing-core pricing-model-to-charge-mode mapping, developer plan CRUD endpoints, app submission default-plan backfill, public plan/tier display, install-time plan selection, selected-plan persistence on installations, and server-priced charge creation from selected plan snapshots.
- Added app-charge trial fields and `trialing` status, copied selected plan trial days onto charges, deferred payout activation until trial expiry, exposed an internal expired-trial activation hook, and updated My Apps charge approval messaging for trialing charges.
- Added app usage event/rollup tables, shared usage DTOs, billing-core included-usage calculations, app-token usage ingest, developer usage summary endpoint/API client method, BFF action, and an on-demand Partner Console usage panel.
- Added merchant app spend controls with monthly caps, alert thresholds, read/update routes, app charge blocking, usage metering blocking, BFF wiring, and a My Apps spend-control panel.
- Added optional uninstall feedback capture with a dedicated table, gateway persistence, BFF forwarding, and merchant dialog reason field.

## Wave 2 Changes

- Added `app_versions` with developer-owner RLS, version status, rollout percentage/cohort metadata, review linkage, and release-note/changelog storage.
- Added marketplace app edit and version creation routes, API client methods, BFF actions, Partner Console edit/version controls, `marketplace_apps.version` bumping, and re-review record creation on submitted updates.
- Replaced placeholder changelog rendering with real `app_versions` release history.
- Captured developer tax ID, ToS consent, privacy consent, policy versions, consent timestamp, approval request timestamp, and KYC status during registration.
- Added a fail-closed internal developer approval endpoint plus Partner Console applicant status messaging and a review-submission gate for non-approved developers.
- Replaced hardcoded submission `passed` checks with package-owned checks for developer approval, HTTPS app/privacy URLs, OAuth redirects, manifest validation, scopes, and static security review.
- Added a basic in-house static security scan for manifest Wasm module URLs; paid security-vendor integration remains human-approved.
- Wired icon and screenshot upload controls through the marketplace BFF to the existing gateway upload client with type/size validation and local/sandbox fallback.
- Required at least one real screenshot before non-draft app review submission and removed fake screenshot placeholders from listing detail pages.
- Updated the no-credential developer tooling contract fixture to satisfy the new real screenshot requirement.

## Wave 3 Changes

- Replaced the install-panel OAuth throw with a real BFF action that performs PKCE authorize/token calls server-side and returns only redacted installation/token metadata to the browser.
- Kept OAuth as the marketplace UI's canonical install path while leaving the legacy direct-token path as a compatibility fallback that still needs internal-only hardening.
- Replaced the extension configuration stub with a registry-backed merchant panel that lists and toggles app extensions and functions through the existing gateway endpoints.
- Added embedded app launch from My Apps using server-side token exchange, embed-session creation, and a bridge fetch probe without exposing app tokens.
- Added a real public developer profile gateway endpoint, API client method, and profile page that shows approved developer details plus published apps.
- Added granted-scope review and per-scope revocation from My Apps with a tenant-checked gateway endpoint, BFF action, and installation-state refresh.
- Added post-install setup checklist content derived from actual installation, scopes, config, embedded launch, and billing state.

## Wave 4 Changes

- Added `100_app_discovery_foundation.sql` with category metadata, first-party demo app seed data, `app_collections`, `app_collection_items`, `app_featured_placements`, and `app_discovery_events`.
- Seeded only clearly labeled first-party demo apps with zero installs, zero reviews, and zero ratings; real launch-partner onboarding remains human-approved.
- Added DB-backed category responses with real published-app counts and made the hardcoded category list fallback-only.
- Added published collection list/detail endpoints, a real `/collections` index, and DB-backed collection detail pages for `staff-picks`, `trending`, and `made-in-india`.
- Added featured-placement inventory and wired the homepage featured rail to the placement endpoint instead of filtering the current catalog page.
- Added server-side rating filters, paid-pricing expansion, featured/collection filtering, and pagination through the gateway list endpoint.
- Added a search compare tray for up to three apps and removed client-only whole-catalog rating filtering.
- Added recommendations/alternatives endpoint and rendered same-category alternatives plus compatibility-overlap "also installed" apps on detail pages.
- Added discovery analytics event ingest and browser capture for search, zero-results, and app-click events through the existing search BFF route.

## Wave 5 Changes

- Added `101_app_trust_reviews_content.sql` with Built-for-LetBuyy fields/checks, review reply/report/fraud/moderation fields, review/listing reports, app activity events, review policy source rows, data-handling disclosure fields, support SLA, health/status URL, works-with metadata, and app conflict IDs.
- Added DB-backed Built-for-LetBuyy badge rendering and seeded only first-party demo award data; periodic award re-check scheduling remains pending.
- Replaced the partner directory placeholder with approved-developer data from the gateway, including published app and Built-for app counts.
- Added a source-backed review policy endpoint and developer review-requirements page; final legal/policy wording remains `SKIPPED (HUMAN-APPROVAL)`.
- Added developer review replies through gateway, API client, existing marketplace BFF route, Partner Console reply controls, and app-detail reply rendering.
- Added review and listing abuse reports with tenant checks, idempotent open-report behavior, activity events, and report buttons that submit real moderation records.
- Added active-install verification persistence for reviews via `verified_installation_id`.
- Added basic review fraud scoring for short/duplicate/title-body duplicate review patterns and automatically flags high-risk reviews for ops moderation.
- Added an ops review moderation queue page with publish, dismiss, reject, and keep-flagged actions through a typed gateway moderation endpoint.
- Added structured data-handling disclosure capture/validation and listing rendering.
- Added app conflict metadata capture and install-time conflict rejection for active conflicting app installs in the same store.
- Added support SLA and works-with metadata capture/rendering.
- Added app health/status fields and listing display; active status polling/incident ingestion remains partial for later scale/ops work.
- Added merchant app activity/event history for install, uninstall, review, and report events in My Apps.

## Wave 6 Changes

- Added `102_app_developer_tooling_analytics.sql` with partner analytics rollups, per-app API usage metrics, persisted collaborator codes, agency seats, partner tiers, sandbox-store requests, demo sessions, and telemetry events.
- Wired partner analytics through gateway endpoints, API client methods, the developer BFF, and Partner Console chart cards.
- Replaced non-persistent collaborator code generation with stored active codes plus redemption that grants agency seats.
- Made `app_webhooks` live with developer-owned create/list/update/archive routes, API client methods, BFF actions, and a Partner Console webhook manager.
- Added per-app API usage recording from `app-api` token routes and exposed request/error/latency metrics in the Partner Console.
- Added computed partner tiers that persist current tier evidence and display active program standing.
- Added sandbox-store request flow and UI; actual infrastructure provisioning remains human-approved.
- Added merchant demo-session/test-drive creation and a listing detail launch button when an app exposes a launch URL.
- Wired browser telemetry to a real stored sink through `app_telemetry_events` while preserving local UI event dispatch for client-side listeners.

## Wave 7 Changes

- Added `appOAuthRateLimit` for app OAuth/bridge endpoints and mounted it before the public app-store router for authorize, token, token-exchange, and bridge fetch calls.
- Added `103_app_api_quota_and_legacy_rls.sql` with `app_api_quotas`, per-scope quota indexes, service-role-only policies, developer/site-owner read policies, legacy marketplace RLS policies, and additive `store_id` to `site_id` convergence for app installations/reviews.
- Added gateway quota enforcement on app-token usage-event, product, order, and installation-metadata routes, with daily reset, fail-closed quota storage handling, and `X-App-Quota-*` response headers exposed through CORS.
- Extracted app compliance webhook delivery into a reusable dispatcher that preserves fail-closed manual compliance routes.
- Wired `customers/redact` to a real merchant customer redaction lifecycle that clears customer profile data, deletes addresses, and triggers app compliance webhooks.
- Wired `shop/redact` to actual admin store deletion before the site record is deleted, so installed app subscriptions receive shop redaction from a real lifecycle event.

## Wave 8 Changes

- Added `104_app_marketplace_scale_services.sql` with a trigger-maintained `marketplace_apps.search_vector`, a GIN search index, and a marketplace analytics queue index.
- Updated the app-store search endpoint to prefer the `search_vector` path when the migration exists, fall back to the legacy ILIKE query when local databases have not applied it, and apply deterministic relevance scoring for the first ranked window.
- Added a shared marketplace analytics queue helper that writes tenant-scoped discovery and telemetry events to `platform_queue_jobs` and nudges `ANALYTICS_QUEUE` when the Cloudflare binding exists.
- Wired discovery event ingest and developer telemetry ingest through that queue helper while still persisting the raw `app_discovery_events` and `app_telemetry_events` rows.
- Replaced direct-only app lifecycle webhook dispatch with durable `webhook_deliveries` enqueueing for subscriptions that have persisted IDs, leaving direct webhook-service dispatch only as a compatibility fallback.
- Passed inserted app webhook subscription IDs through direct install, OAuth install, uninstall, and compliance webhook paths so lifecycle/compliance deliveries can retry and dead-letter through the existing webhook worker.
- Removed the upload route's hardcoded production CDN fallback, sanitized upload folders/extensions, added R2 object metadata, and made production media serving fail closed unless `ASSET_PUBLIC_BASE_URL` is configured.
- Multi-region infrastructure remains design/approval-only; no new runtime root or provider configuration was added.

## Wave 9 Changes

- Added `105_app_marketplace_responsiveness_i18n.sql` with additive `marketplace_apps.currency` and `marketplace_apps.video_captions_url` fields.
- Added marketplace fluid type tokens with `clamp()` and replaced large fixed display sizing across marketplace hero, detail, category, developer, and empty-state surfaces.
- Added a reusable accessible `MarketplaceBreadcrumbs` component and wired it into app detail, category detail, and collection detail pages.
- Replaced the old anchor-only screenshot lightbox with a JavaScript dialog gallery that supports Escape, arrow keys, carousel controls, backdrop close, labeled icon controls, and focus-visible styling.
- Added shared DTO support for `currency` and `video_captions_url`, and made app detail pricing/JSON-LD currency-aware.
- Changed demo video rendering so videos are shown only when a captions URL exists; otherwise the listing renders honest generic unavailable copy.
- Extended marketplace i18n message coverage for retry, breadcrumbs, media, and policy copy, and kept governance-copy residue out of user-facing app-marketplace source.
- Preserved dark-mode behavior for new surfaces by routing visual styling through marketplace/shared CSS variables; formal visual dark-mode and WCAG browser evidence remains partial.

## Wave 10 Changes

- Added `106_app_marketplace_growth_polish.sql` with category SEO content fields, `app_requests`, `app_saved_apps`, `app_bundles`, `app_bundle_items`, and `app_review_proofs`.
- Added request-an-app capture through a tenant-aware gateway endpoint, API client methods, the existing marketplace search BFF route, and request forms on homepage, search zero-results, and empty category states.
- Added saved apps with site ownership checks, save/list/delete gateway methods, API client methods, existing search BFF actions, a listing detail save control, and a homepage saved-apps panel.
- Added non-secret recently viewed app tracking with localStorage and homepage/detail rails that avoid storing tokens or sensitive data.
- Added source-backed category SEO content, buyer guidance, and FAQs from `app_categories`, including metadata generation from live category data with fallback-only constants.
- Added a data-driven new-this-week endpoint and homepage rail that uses real published/created/updated app timestamps and hides when no qualifying apps exist.
- Added app bundle inventory, typed bundle responses, homepage bundle cards, and a disclosed first-party demo bundle; single-transaction bundle purchase orchestration remains partial.
- Added verified-install review proof records, backfilled proofs for existing verified reviews, write-through proof creation on review submit, public proof response data, and review proof badges; external proof import remains partial.

## Wave 11 Changes

- Added app marketplace runbooks for catalog operations, payout ledger settlement, review queue triage, and incident response.
- Added repository developer docs scaffolds for getting started, API reference, and manifest specification.
- Added repository policy docs for marketplace economics, review policy, and trust/security.
- Added public marketplace developer docs routes at `/developers/docs` and `/developers/docs/[topic]`, with footer and developer landing page links to the real docs surface.
- Added governance and audit reconciliation docs to record V2 source authority, implemented areas, partial areas, and known external blockers.
- Regenerated repository intelligence after the route/docs changes.

## Wave 1 Verification

- `pnpm install --frozen-lockfile` — PASS when rerun outside sandbox; sandbox DNS failed with `ENOTFOUND registry.npmjs.org`
- `pnpm --filter @letbuyy/billing-core typecheck` — PASS
- `pnpm --filter @letbuyy/shared-types typecheck` — PASS
- `pnpm --filter @letbuyy/event-core typecheck` — PASS
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS
- `pnpm --filter @letbuyy/queue-workers typecheck` — PASS
- `pnpm --filter @letbuyy/app-marketplace typecheck` — PASS
- `pnpm --filter @letbuyy/shared-types build` — PASS
- `pnpm --filter @letbuyy/api-gateway build` — PASS
- `pnpm --filter @letbuyy/queue-workers build` — PASS
- `pnpm --filter @letbuyy/billing-core build` — PASS
- `pnpm --filter @letbuyy/event-core build` — PASS
- `pnpm --filter @letbuyy/app-marketplace lint` — PASS
- `pnpm --filter @letbuyy/app-marketplace typecheck` — PASS after paid-charge UI
- `pnpm --filter @letbuyy/app-marketplace lint` — PASS after paid-charge UI
- `pnpm --filter @letbuyy/app-marketplace test` — PASS after paid-charge UI, 23/23 tests
- `pnpm --filter @letbuyy/app-marketplace build` — PASS after paid-charge UI when rerun outside sandbox for Turbopack; in-sandbox rerun was terminated after hanging in Next optimization
- `pnpm --filter @letbuyy/billing-core test` — PASS when rerun outside sandbox; sandbox `tsx` IPC failed with `EPERM`
- `pnpm --filter @letbuyy/event-core test` — PASS when rerun outside sandbox; sandbox `tsx` IPC failed with `EPERM`
- `pnpm --filter @letbuyy/queue-workers test` — PASS, 4/4 tests
- `pnpm --filter @letbuyy/app-marketplace test` — PASS, 23/23 tests
- `pnpm --filter @letbuyy/api-gateway test` — PASS when rerun outside sandbox; sandbox `tsx` IPC failed with `EPERM`
- `pnpm --filter @letbuyy/app-marketplace build` — PASS when run outside sandbox for Turbopack
- `node scripts/validate-governance.mjs` — PARTIAL: marketplace-relevant dependency/runtime/source-ledger validators pass; full suite still fails on pre-existing unrelated `services/api-gateway/src/routes/themes.ts` route line-count (1793 > 1500)
- `pnpm --filter @letbuyy/shared-types typecheck` — PASS after pricing-plan DTOs
- `pnpm --filter @letbuyy/shared-types build` — PASS after pricing-plan DTOs
- `pnpm --filter @letbuyy/billing-core typecheck` — PASS after pricing-plan mapping helper
- `pnpm --filter @letbuyy/billing-core build` — PASS after pricing-plan mapping helper
- `pnpm --filter @letbuyy/billing-core test` — PASS outside sandbox, 4/4 tests; sandbox `tsx` IPC failed with `EPERM`
- `pnpm --filter @letbuyy/api-client typecheck` — PASS after rebuilding shared-types declarations
- `pnpm --filter @letbuyy/api-client build` — PASS
- `pnpm --filter @letbuyy/billing-core typecheck` — PASS after #23
- `pnpm --filter @letbuyy/shared-types typecheck` — PASS after #23
- `pnpm --filter @letbuyy/api-client typecheck` — PASS after #23
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS after #23
- `pnpm --filter @letbuyy/app-marketplace typecheck` — PASS after #23
- `pnpm --filter @letbuyy/billing-core typecheck` — PASS after #22
- `pnpm --filter @letbuyy/shared-types typecheck` — PASS after #22
- `pnpm --filter @letbuyy/shared-types build` — PASS after #22, refreshed declaration output for API client/app consumers
- `pnpm --filter @letbuyy/api-client typecheck` — PASS after #22
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS after #22
- `pnpm --filter @letbuyy/app-marketplace typecheck` — PASS after #22
- `pnpm install --frozen-lockfile` — PASS after rerun outside sandbox; sandbox run failed with registry DNS `ENOTFOUND`
- `pnpm --filter @letbuyy/shared-types build` — PASS after #62
- `pnpm --filter @letbuyy/shared-types typecheck` — PASS after #62
- `pnpm --filter @letbuyy/billing-core typecheck` — PASS after #62
- `pnpm --filter @letbuyy/api-client typecheck` — PASS after #62
- `pnpm --filter @letbuyy/app-marketplace typecheck` — PASS after #62
- `pnpm --filter @letbuyy/api-gateway typecheck` — BLOCKED after #62 by unrelated pre-existing `services/api-gateway/src/routes/themes.ts` missing theme symbols (`ThemeMarketplaceSettingsSchema`, `ThemeSavedSearchSchema`, `ThemeDeveloperListingSchema`)
- `pnpm --filter @letbuyy/app-marketplace typecheck` — PASS after #63
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS after #63
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS after pricing-plan routes
- `pnpm --filter @letbuyy/api-gateway build` — PASS after pricing-plan routes
- `pnpm --filter @letbuyy/api-gateway test` — PASS outside sandbox, 193/193 tests; sandbox `tsx` IPC failed with `EPERM`
- `pnpm --filter @letbuyy/app-marketplace typecheck` — PASS after plan UI/BFF
- `pnpm --filter @letbuyy/app-marketplace lint` — PASS after plan UI/BFF
- `pnpm --filter @letbuyy/app-marketplace test` — PASS after plan UI/BFF, 23/23 tests
- `pnpm --filter @letbuyy/app-marketplace build` — PASS outside sandbox for Turbopack
- `supabase migration list --local` — PARTIAL: local DB reachable, but migrations `084`-`093` are pending while remote-style history entries `000001`-`000083` are missing from local files
- `supabase migration up --local` — FAIL due pre-existing migration-history mismatch; did not apply `093`
- rollback replay through `docker exec ... psql` — FAIL at FK stage because the local database lacks `public.marketplace_apps`; no schema change persisted due transaction abort
- `node scripts/validate-governance.mjs` — PARTIAL after pricing-plan work: single-writer, domain-boundary, dead-residue, repository intelligence validators pass; full suite still fails only on pre-existing unrelated `services/api-gateway/src/routes/themes.ts` route line-count (1793 > 1500)

### Latest Wave 1 Gate Refresh (after #22/#23/#62/#63 and FOUND-001)

- `pnpm install --lockfile-only --no-frozen-lockfile` — PASS outside sandbox; sandbox DNS failed on package metadata lookup.
- `pnpm install --no-frozen-lockfile` — PASS outside sandbox; restored workspace links after offline relink could not find a cached `jose` tarball.
- `pnpm --filter @letbuyy/app-marketplace typecheck` — PASS.
- `pnpm --filter @letbuyy/app-marketplace lint` — PASS.
- `pnpm --filter @letbuyy/app-marketplace test` — PASS, 23/23 tests.
- `pnpm --filter @letbuyy/app-marketplace build` — PASS outside sandbox; sandbox Turbopack run failed with helper-process/port `Operation not permitted`.
- `pnpm --filter @letbuyy/shared-types typecheck` — PASS.
- `pnpm --filter @letbuyy/shared-types build` — PASS.
- `pnpm --filter @letbuyy/billing-core typecheck` — PASS.
- `pnpm --filter @letbuyy/billing-core build` — PASS.
- `pnpm --filter @letbuyy/billing-core test` — PASS outside sandbox, 6/6 tests.
- `pnpm --filter @letbuyy/api-client typecheck` — PASS.
- `pnpm --filter @letbuyy/api-client build` — PASS.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `pnpm --filter @letbuyy/api-gateway build` — PASS.
- `pnpm --filter @letbuyy/api-gateway lint` — NOT AVAILABLE: package has no `lint` script.
- `pnpm --filter @letbuyy/api-gateway test` — BLOCKED by unrelated theme-marketplace hardcoded-domain contract residue; 192/193 tests passed, failing test is `future platform .com target is not hardcoded in active app, service, or package source`.
- `pnpm --filter @letbuyy/queue-workers typecheck` — PASS.
- `pnpm --filter @letbuyy/queue-workers build` — PASS.
- `pnpm --filter @letbuyy/queue-workers test` — PASS, 4/4 tests.
- `node scripts/validate-governance.mjs` — BLOCKED by unrelated theme-marketplace environment honesty residue: `apps/theme-marketplace/src/app/auth/callback/route.ts`, `apps/theme-marketplace/src/components/layout/footer.tsx`, `apps/theme-marketplace/src/lib/public-urls.ts`, and `apps/theme-marketplace/src/proxy.ts` hardcode retired `.com` defaults. Marketplace-relevant validators completed before this failure.

### Latest Wave 2 Gate Refresh

- `pnpm --filter @letbuyy/app-marketplace lint` — PASS.
- `pnpm --filter @letbuyy/app-marketplace typecheck` — PASS.
- `pnpm --filter @letbuyy/app-marketplace test` — PASS, 23/23 tests.
- `pnpm --filter @letbuyy/app-marketplace build` — PASS outside sandbox; in-sandbox Turbopack failed with helper-process/port `Operation not permitted`.
- `pnpm --filter @letbuyy/app-engine typecheck` — PASS.
- `pnpm --filter @letbuyy/app-engine build` — PASS.
- `pnpm --filter @letbuyy/app-engine test` — PASS outside sandbox, 2/2 tests; in-sandbox `tsx` IPC failed with `EPERM`.
- `pnpm --filter @letbuyy/shared-types typecheck` — PASS.
- `pnpm --filter @letbuyy/shared-types build` — PASS.
- `pnpm --filter @letbuyy/api-client typecheck` — PASS.
- `pnpm --filter @letbuyy/api-client build` — PASS.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `pnpm --filter @letbuyy/api-gateway build` — PASS.
- `pnpm --filter @letbuyy/api-gateway test` — BLOCKED by unrelated theme-marketplace hardcoded-domain contract residue; 192/193 tests passed after the marketplace submission fixture update, failing test is `future platform .com target is not hardcoded in active app, service, or package source`.
- `pnpm --filter @letbuyy/queue-workers typecheck` — PASS.
- `pnpm --filter @letbuyy/queue-workers test` — PASS, 4/4 tests.
- `node scripts/validate-governance.mjs` — BLOCKED by unrelated theme-marketplace environment honesty residue: `apps/theme-marketplace/src/app/auth/callback/route.ts`, `apps/theme-marketplace/src/components/layout/footer.tsx`, `apps/theme-marketplace/src/lib/public-urls.ts`, and `apps/theme-marketplace/src/proxy.ts` hardcode retired `.com` defaults. Marketplace-relevant validators completed before this failure.

### Latest Wave 3 Gate Refresh

- `pnpm --filter @letbuyy/app-marketplace lint` — PASS.
- `pnpm --filter @letbuyy/app-marketplace typecheck` — PASS.
- `pnpm --filter @letbuyy/app-marketplace test` — PASS, 23/23 tests.
- `pnpm --filter @letbuyy/app-marketplace build` — PASS outside sandbox; in-sandbox Turbopack run was killed after hanging on a helper process.
- `pnpm --filter @letbuyy/api-client typecheck` — PASS.
- `pnpm --filter @letbuyy/api-client build` — PASS.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `pnpm --filter @letbuyy/api-gateway build` — PASS.
- `pnpm --filter @letbuyy/api-gateway test` — BLOCKED only by unrelated theme-marketplace hardcoded-domain contract residue; 192/193 tests passed and the marketplace app-store route registration/order test passed after restoring `/developers/:id` in the developer route module.
- `node scripts/validate-governance.mjs` — BLOCKED by unrelated theme-marketplace environment honesty residue: `apps/theme-marketplace/src/app/auth/callback/route.ts`, `apps/theme-marketplace/src/components/layout/footer.tsx`, `apps/theme-marketplace/src/lib/public-urls.ts`, and `apps/theme-marketplace/src/proxy.ts` hardcode retired `.com` defaults. Marketplace-relevant validators completed before this failure.

### Latest Wave 4 Gate Refresh

- `pnpm --filter @letbuyy/shared-types typecheck` — PASS.
- `pnpm --filter @letbuyy/shared-types build` — PASS.
- `pnpm --filter @letbuyy/api-client typecheck` — PASS.
- `pnpm --filter @letbuyy/api-client build` — PASS.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `pnpm --filter @letbuyy/api-gateway build` — PASS.
- `pnpm --filter @letbuyy/app-marketplace lint` — PASS.
- `pnpm --filter @letbuyy/app-marketplace typecheck` — PASS.
- `pnpm --filter @letbuyy/app-marketplace test` — PASS, 23/23 tests.
- `pnpm --filter @letbuyy/app-marketplace build` — PASS outside sandbox; in-sandbox Turbopack build hung in optimization and was terminated cleanly.
- `find apps/app-marketplace/src/app/api -type d -empty -print` — PASS, no output.
- `pnpm --filter @letbuyy/api-gateway test` — BLOCKED only by unrelated theme-marketplace hardcoded-domain contract residue; 192/193 tests passed and marketplace route/order tests passed.
- `node scripts/validate-governance.mjs` — BLOCKED by unrelated theme-marketplace environment honesty residue: `apps/theme-marketplace/src/app/auth/callback/route.ts`, `apps/theme-marketplace/src/components/layout/footer.tsx`, `apps/theme-marketplace/src/lib/public-urls.ts`, and `apps/theme-marketplace/src/proxy.ts` hardcode retired `.com` defaults. Marketplace-relevant validators completed before this failure.

### Latest Wave 5 Gate Refresh

- `pnpm --filter @letbuyy/shared-types typecheck` — PASS.
- `pnpm --filter @letbuyy/shared-types build` — PASS.
- `pnpm --filter @letbuyy/app-engine typecheck` — PASS.
- `pnpm --filter @letbuyy/app-engine build` — PASS.
- `pnpm --filter @letbuyy/app-engine test` — PASS outside sandbox, 2/2 tests; in-sandbox `tsx` IPC failed with `EPERM`.
- `pnpm --filter @letbuyy/api-client typecheck` — PASS.
- `pnpm --filter @letbuyy/api-client build` — PASS.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `pnpm --filter @letbuyy/api-gateway build` — PASS.
- `pnpm --filter @letbuyy/app-marketplace typecheck` — PASS.
- `pnpm --filter @letbuyy/app-marketplace lint` — PASS.
- `pnpm --filter @letbuyy/app-marketplace test` — PASS, 23/23 tests.
- `pnpm --filter @letbuyy/app-marketplace build` — PASS outside sandbox; in-sandbox Turbopack build previously hung in optimization.
- `wc -l services/api-gateway/src/routes/app-store.ts services/api-gateway/src/routes/app-store/developer-routes.ts services/api-gateway/src/routes/app-store/install-lifecycle-routes.ts` — PASS route cap: `app-store.ts` 1084, `developer-routes.ts` 1492, `install-lifecycle-routes.ts` 543.
- `pnpm --filter @letbuyy/api-gateway test` — BLOCKED only by unrelated theme-marketplace hardcoded-domain contract residue; 192/193 tests passed, including marketplace app submission and app-store split/order contracts.
- `node scripts/validate-governance.mjs` — BLOCKED by unrelated theme-marketplace environment honesty residue: `apps/theme-marketplace/src/app/auth/callback/route.ts`, `apps/theme-marketplace/src/components/layout/footer.tsx`, `apps/theme-marketplace/src/lib/public-urls.ts`, and `apps/theme-marketplace/src/proxy.ts` hardcode retired `.com` defaults. Marketplace-relevant validators completed before this failure.

### Latest Wave 6 Gate Refresh

- `pnpm --filter @letbuyy/shared-types typecheck` — PASS.
- `pnpm --filter @letbuyy/shared-types build` — PASS.
- `pnpm --filter @letbuyy/api-client typecheck` — PASS.
- `pnpm --filter @letbuyy/api-client build` — PASS.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `pnpm --filter @letbuyy/api-gateway build` — PASS.
- `pnpm --filter @letbuyy/app-marketplace typecheck` — PASS.
- `pnpm --filter @letbuyy/app-marketplace lint` — PASS.
- `pnpm --filter @letbuyy/app-marketplace test` — PASS, 23/23 tests.
- `pnpm --filter @letbuyy/app-marketplace build` — PASS outside sandbox; in-sandbox Turbopack run stalled on `.next/lock` and the stuck helper process was killed before the escalated rerun passed.
- `npx tsx --test tests/contracts/app-store-route-split.test.ts` — PASS, 3/3 tests.
- `wc -l services/api-gateway/src/routes/app-store.ts services/api-gateway/src/routes/app-store/developer-routes.ts services/api-gateway/src/routes/app-store/developer-tooling-routes.ts services/api-gateway/src/routes/app-api.ts` — PASS route cap: `app-store.ts` 1087, `developer-routes.ts` 1471, `developer-tooling-routes.ts` 521, `app-api.ts` 642.
- `pnpm --filter @letbuyy/api-gateway test` — BLOCKED only by unrelated theme-marketplace hardcoded-domain contract residue; 192/193 tests passed after the marketplace app-store route registration/order update.
- `node scripts/generate-repository-intelligence.mjs` — PASS.
- `node scripts/validate-governance.mjs` — BLOCKED only by unrelated theme-marketplace environment honesty residue: `apps/theme-marketplace/src/app/auth/callback/route.ts`, `apps/theme-marketplace/src/components/layout/footer.tsx`, `apps/theme-marketplace/src/lib/public-urls.ts`, and `apps/theme-marketplace/src/proxy.ts` hardcode retired `.com` defaults. Marketplace-relevant validators completed before this failure.

### Latest Wave 7 Gate Refresh

- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `pnpm --filter @letbuyy/api-gateway build` — PASS.
- `npx tsx --test tests/contracts/app-store-route-split.test.ts` — PASS, 3/3 tests.
- `npx tsx --test tests/contracts/app-compliance-webhooks.test.ts tests/contracts/env-domain-contract.test.ts` — PARTIAL: app compliance contracts passed; env-domain contract failed only on unrelated theme-marketplace hardcoded-domain residue after `customers.ts` was removed from the offender list.
- `wc -l services/api-gateway/src/routes/app-api.ts services/api-gateway/src/routes/app-store/compliance-routes.ts services/api-gateway/src/routes/customers.ts services/api-gateway/src/routes/admin.ts services/api-gateway/src/middleware/rateLimit.ts` — PASS route cap: `app-api.ts` 802, `compliance-routes.ts` 193, `customers.ts` 458, `admin.ts` 355, `rateLimit.ts` 1097.
- `pnpm --filter @letbuyy/api-gateway test` — sandbox run failed with `tsx` IPC `EPERM`; escalated rerun completed 192/193 PASS and failed only on unrelated theme-marketplace hardcoded-domain residue.
- `supabase migration up --local` — sandbox run failed on Supabase telemetry write to `~/.supabase`; escalated rerun reached the known local migration-history blocker (`000001`-`000083` remote-style entries not present in local migrations).
- `node scripts/generate-repository-intelligence.mjs` — PASS.
- `node scripts/validate-governance.mjs` — BLOCKED only by unrelated theme-marketplace environment honesty residue: `apps/theme-marketplace/src/app/auth/callback/route.ts`, `apps/theme-marketplace/src/components/layout/footer.tsx`, `apps/theme-marketplace/src/lib/public-urls.ts`, and `apps/theme-marketplace/src/proxy.ts` hardcode retired `.com` defaults. Marketplace-relevant validators completed before this failure.

### Latest Wave 8 Gate Refresh

- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `pnpm --filter @letbuyy/api-gateway build` — PASS.
- `pnpm --filter @letbuyy/api-gateway lint` — N/A, selected package has no `lint` script.
- `npx tsx --test tests/contracts/app-store-route-split.test.ts` — PASS, 3/3 tests.
- `npx tsx --test tests/contracts/app-compliance-webhooks.test.ts tests/contracts/cloudflare-queue-triggers.test.ts` — PASS, 4/4 app compliance tests plus existing Cloudflare queue trigger coverage.
- `wc -l services/api-gateway/src/routes/app-store.ts services/api-gateway/src/routes/app-store/shared.ts services/api-gateway/src/routes/upload.ts services/api-gateway/src/routes/app-store/developer-tooling-routes.ts` — PASS route cap: `app-store.ts` 1220, `shared.ts` 953, `upload.ts` 164, `developer-tooling-routes.ts` 554.
- `pnpm --filter @letbuyy/api-gateway test` — sandbox run failed with `tsx` IPC `EPERM`; escalated rerun completed 192/193 PASS and failed only on unrelated theme-marketplace hardcoded-domain residue (`apps/theme-marketplace/src/app/auth/callback/route.ts`, `contact/page.tsx`, `support/page.tsx`, `components/info-placeholder.tsx`, `components/layout/footer.tsx`, `components/policy-draft-page.tsx`, `src/lib/public-urls.ts`, `src/proxy.ts`).
- `supabase migration up --local` — sandbox run failed on Supabase telemetry write to `~/.supabase`; escalated rerun reached the known local migration-history blocker (`000001`-`000083` remote-style entries not present in local migrations), so `104_app_marketplace_scale_services.sql` is written but not locally applied.
- `node scripts/generate-repository-intelligence.mjs` — PASS.
- `node scripts/validate-governance.mjs` — BLOCKED only by unrelated theme-marketplace environment honesty residue: `apps/theme-marketplace/src/app/auth/callback/route.ts`, `apps/theme-marketplace/src/components/layout/footer.tsx`, `apps/theme-marketplace/src/lib/public-urls.ts`, and `apps/theme-marketplace/src/proxy.ts` hardcode retired `.com` defaults. Marketplace-relevant validators completed before this failure.

### Latest Wave 9 Gate Refresh

- `pnpm --filter @letbuyy/shared-types typecheck` — PASS.
- `pnpm --filter @letbuyy/shared-types build` — PASS.
- `pnpm --filter @letbuyy/api-client typecheck` — PASS.
- `pnpm --filter @letbuyy/api-client build` — PASS.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `pnpm --filter @letbuyy/app-marketplace typecheck` — PASS.
- `pnpm --filter @letbuyy/app-marketplace lint` — PASS after replacing raw screenshot-gallery buttons with shared `Button`.
- `pnpm --filter @letbuyy/app-marketplace test` — PASS, 23/23 tests after preserving literal retry copy in `MarketplaceUnavailable`.
- `pnpm --filter @letbuyy/app-marketplace build` — sandbox Turbopack run hung and stuck helper processes were killed; escalated rerun passed with 21/21 static pages generated.
- `rg -n "HUMAN-APPROVAL|human approval|SKIPPED|contract-gated|pending business approval|Flag: NEXT_PUBLIC" apps/app-marketplace/src` — PASS, no user-facing governance-copy residue.
- `rg -n "letter-spacing:\s*-|screenshot-lightbox-close|href=.*#screenshot|<track kind=\"captions\"[[:space:]]*/>" apps/app-marketplace/src` — PASS, no negative letter-spacing or old anchor-lightbox residue.
- `node scripts/generate-repository-intelligence.mjs` — PASS.
- `node scripts/validate-governance.mjs` — BLOCKED only by unrelated theme-marketplace environment honesty residue: `apps/theme-marketplace/src/app/auth/callback/route.ts`, `apps/theme-marketplace/src/components/layout/footer.tsx`, `apps/theme-marketplace/src/lib/public-urls.ts`, and `apps/theme-marketplace/src/proxy.ts` hardcode retired `.com` defaults. Marketplace-relevant validators completed before this failure.
- `supabase migration up --local` — sandbox run failed on Supabase telemetry write to `~/.supabase`; escalated rerun reached the known local migration-history blocker (`000001`-`000083` remote-style entries not present in local migrations), so `105_app_marketplace_responsiveness_i18n.sql` is written but not locally applied.

### Latest Wave 10 Gate Refresh

- `pnpm --filter @letbuyy/shared-types typecheck` — PASS.
- `pnpm --filter @letbuyy/shared-types build` — PASS.
- `pnpm --filter @letbuyy/api-client typecheck` — PASS.
- `pnpm --filter @letbuyy/api-client build` — PASS.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `pnpm --filter @letbuyy/api-gateway build` — PASS.
- `npx tsx --test tests/contracts/app-store-route-split.test.ts` — PASS, 3/3 tests.
- `npx tsx --test tests/contracts/inr-currency-format-single-source.test.ts` — PASS, 3/3 tests after app detail pricing uses the shared INR formatter.
- `pnpm --filter @letbuyy/app-marketplace lint` — PASS after moving growth BFF actions into the existing search route and avoiding set-state-in-effect in recently viewed tracking.
- `pnpm --filter @letbuyy/app-marketplace typecheck` — PASS.
- `pnpm --filter @letbuyy/app-marketplace test` — PASS, 23/23 tests.
- `pnpm --filter @letbuyy/app-marketplace build` — sandbox Turbopack run stalled and was stopped; escalated rerun passed with 21/21 static pages generated.
- `pnpm --filter @letbuyy/api-gateway test` — BLOCKED only by unrelated theme-marketplace hardcoded-domain contract residue; escalated rerun completed 192/193 tests and the only failure is the theme-marketplace environment-domain contract.
- `node scripts/generate-repository-intelligence.mjs` — PASS.
- `node scripts/validate-governance.mjs` — BLOCKED only by unrelated theme-marketplace environment honesty residue: `apps/theme-marketplace/src/app/auth/callback/route.ts`, `apps/theme-marketplace/src/components/layout/footer.tsx`, `apps/theme-marketplace/src/lib/public-urls.ts`, and `apps/theme-marketplace/src/proxy.ts` hardcode retired `.com` defaults. Marketplace-relevant validators completed before this failure.
- `supabase migration up --local` — sandbox run failed on Supabase telemetry write to `~/.supabase`; escalated rerun reached the known local migration-history blocker (`000001`-`000083` remote-style entries not present in local migrations), so `106_app_marketplace_growth_polish.sql` is written but not locally applied.

### Latest Wave 11 Gate Refresh

- `pnpm --filter @letbuyy/app-marketplace typecheck` — PASS.
- `pnpm --filter @letbuyy/app-marketplace lint` — PASS.
- `pnpm --filter @letbuyy/app-marketplace test` — PASS, 23/23 tests.
- `pnpm --filter @letbuyy/app-marketplace build` — PASS outside sandbox with 28/28 static pages generated, including `/developers/docs` and `/developers/docs/[topic]`.
- `pnpm --filter @letbuyy/billing-core typecheck` — PASS after adding app charge cancellation schema.
- `pnpm --filter @letbuyy/billing-core build` — PASS.
- `pnpm --filter @letbuyy/billing-core test` — PASS outside sandbox, 6/6 tests.
- `pnpm --filter @letbuyy/api-client typecheck` — PASS after adding `cancelCharge`.
- `pnpm --filter @letbuyy/api-client build` — PASS.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS after adding the merchant charge cancel route.
- `pnpm --filter @letbuyy/api-gateway build` — PASS.
- `pnpm --filter @letbuyy/api-gateway test` — BLOCKED only by unrelated theme-marketplace hardcoded-domain contract residue; escalated rerun completed 192/193 tests.
- `find apps/app-marketplace/src/app/api -type d -empty -print` — PASS, no output.
- `wc -l docs/runbooks/app-marketplace-catalog.md docs/runbooks/app-marketplace-payout-ledger.md docs/runbooks/app-marketplace-review-queue.md docs/runbooks/app-marketplace-incident-response.md docs/apps-marketplace-developer/getting-started.md docs/apps-marketplace-developer/api-reference.md docs/apps-marketplace-developer/manifest-spec.md docs/apps-marketplace-policies/economics.md docs/apps-marketplace-policies/review-policy.md docs/apps-marketplace-policies/trust-security.md docs/governance/apps-marketplace-foundation-v2.md docs/apps-marketplace-audit/FOUNDATION_V2_RECONCILIATION.md` — PASS, 246 total documentation lines.
- `node scripts/generate-repository-intelligence.mjs` — PASS.
- `node scripts/validate-governance.mjs` — BLOCKED only by unrelated theme-marketplace environment honesty residue: `apps/theme-marketplace/src/app/auth/callback/route.ts`, `apps/theme-marketplace/src/components/layout/footer.tsx`, `apps/theme-marketplace/src/lib/public-urls.ts`, and `apps/theme-marketplace/src/proxy.ts` hardcode retired `.com` defaults. Marketplace-relevant validators completed before this failure.

## Human-Approval Items

- #1 Catalog launch partners — SKIPPED (HUMAN-APPROVAL)
  Reason: Choosing real launch-partner apps requires business development, content, and legal approval.
  Unblock: Provide approved partner app listings, developer identities, media, pricing, and legal/BD sign-off for launch.
  Done anyway: Implemented a seed mechanism, DB-backed taxonomy/collections/featured placements, and clearly labeled first-party demo apps that do not fabricate installs, ratings, or reviews.
- #3 Payout settlement — SKIPPED (HUMAN-APPROVAL)
  Reason: Live RazorpayX/Route credentials, payout bank rails, and go-live approval are not available in code.
  Unblock: Provide production payout provider credentials, settlement policy, and approval to execute live transfers.
  Done anyway: Implemented sandbox/dry-run payout state machine, idempotent ledger creation, payout statements, and `payout.released` event emission for test-mode charges.
- #4 Revenue share — SKIPPED (HUMAN-APPROVAL)
  Reason: Final business/legal confirmation of the exact marketplace revenue-share rate and effective date is outside code authority.
  Unblock: Business/legal owner confirms 85% partner share / 15% platform fee and effective date.
  Done anyway: Implemented 8500 bps as the single code default, propagated it through gateway/queue/event/shared contracts, and displayed it in developer-facing UI.
- #5 Developer approval / KYC — SKIPPED (HUMAN-APPROVAL)
  Reason: Final KYC and developer identity policy is a business/legal decision.
  Unblock: Provide the KYC evidence requirements, approval authority, rejection reasons, and policy version.
  Done anyway: Implemented consent capture, approval state fields, fail-closed internal approval endpoint, submission gate, and applicant status UI.
- #21 Media upload — SKIPPED (HUMAN-APPROVAL)
  Reason: Production storage bucket/CDN provisioning and keys are infrastructure/secret work outside code authority.
  Unblock: Provision the production app-marketplace media bucket/CDN and provide runtime storage configuration.
  Done anyway: Implemented file validation, BFF upload forwarding through the gateway client, local/sandbox upload fallback, icon/screenshot controls, previews, and persisted media URL payloads.
- #38 Security scan — SKIPPED (HUMAN-APPROVAL)
  Reason: Paid security-vendor selection and credentials are business/security procurement decisions.
  Unblock: Select the vendor, provide credentials, and define the pass/fail policy.
  Done anyway: Implemented an in-house static submission scan for public HTTPS URLs, OAuth redirects, scope/manifest integrity, and Wasm module URL safety that blocks hard failures before review.
- #20 Review policy legal wording — SKIPPED (HUMAN-APPROVAL)
  Reason: Final app review policy, moderation, SLA, and legal wording requires legal/policy sign-off.
  Unblock: Provide approved policy text, enforcement SLAs, appeals language, and effective policy version.
  Done anyway: Implemented `app_review_policies`, published a structured source row, added the gateway/API client method, and rendered the policy page from the source instead of user-facing internal placeholder copy.
- #75 Developer docs hosting — SKIPPED (HUMAN-APPROVAL)
  Reason: Public docs hosting and docs-site navigation are deployment/content ownership decisions outside code authority.
  Unblock: Approve the public docs domain/path, hosting target, navigation placement, and publishing workflow.
  Done anyway: Scaffolded repository docs for getting started, API reference, and manifest spec; added public app routes under `/developers/docs` and topic pages; updated footer and developer landing links to resolve to real routes.
- #93 Sandbox/test stores — SKIPPED (HUMAN-APPROVAL)
  Reason: Provisioning real sandbox stores requires environment infrastructure and tenant lifecycle approval outside code authority.
  Unblock: Provide sandbox-store provisioning credentials, allowed templates, quota policy, and approval to create real tenant environments.
  Done anyway: Implemented the request table, developer endpoint, BFF action, and Partner Console request/list UI so requests degrade honestly until provisioning is wired.
- #9/#59 Marketplace RLS/quota migration production apply — SKIPPED (HUMAN-APPROVAL)
  Reason: Applying database migrations to staging or production is an environment operation requiring operator approval and migration-window coordination.
  Unblock: Repair local/staging migration history, review `103_app_api_quota_and_legacy_rls.sql`, approve the rollout window, and apply through the production migration process.
  Done anyway: Wrote the additive migration, verified gateway typecheck/build, retried local apply, and recorded the local migration-history blocker.
- Wave 8 scale-service provisioning / multi-region — SKIPPED (HUMAN-APPROVAL)
  Reason: Provisioning Cloudflare queues, media buckets/CDN, webhook-service production dispatch, and multi-region rollout requires infrastructure credentials, topology approval, and operational rollout ownership outside code authority.
  Unblock: Provide queue/media/CDN bindings, production webhook dispatch configuration, multi-region target topology, and approval to cut over provider resources.
  Done anyway: Reused the existing durable `platform_queue_jobs` and `webhook_deliveries` contracts, added the marketplace search-vector migration, wired analytics enqueueing, removed stale CDN fallbacks, and kept production media serving fail-closed without configured asset base URL.
- #86 Translations/locales — SKIPPED (HUMAN-APPROVAL)
  Reason: Final non-English translation strings, locale coverage, and legal/policy wording translations require content/legal ownership.
  Unblock: Provide approved locale list, translated message catalogs, reviewer ownership, and legal-approved policy translations.
  Done anyway: Extended the i18n scaffold and message keys for Wave 9 surfaces, removed user-facing internal governance copy, and kept untranslated UI on the existing English fallback.

## Local Environment Blockers

- #2/#5/#6/#9/#13/#17/#20/#22/#23/#24/#25/#26/#27/#30/#31/#37/#40/#46/#50/#51/#52/#53/#54/#57/#58/#59/#60/#61/#62/#63/#64/#65/#77/#78/#80/#89/#90/#91/#92/#93/#94/#95/#96/#97/#99/W8/W9/W10 Marketplace migrations local apply — BLOCKED (LOCAL-DB-HISTORY)
  Reason: `supabase migration up --local` reports remote-style migration versions `000001` through `000083` in the local history table that do not exist in the local migration directory. Direct rollback replay of `093` through the running Supabase Postgres container failed at the FK stage because this local database lacks `public.marketplace_apps`.
  Unblock: Repair or reset the local Supabase migration history from a known-good baseline, then rerun `supabase migration up --local` from `database/supabase`.
  Done anyway: Governance migration-safety validation passed before the unrelated environment honesty blocker; touched TypeScript build/typecheck/test gates passed; migration SQL is forward-only and additive through `106_app_marketplace_growth_polish.sql`.

- Cross-domain governance blocker — BLOCKED (OUTSIDE-MARKETPLACE-LANE)
  Reason: `node scripts/validate-governance.mjs` and `pnpm --filter @letbuyy/api-gateway test` currently fail on theme-marketplace hardcoded `.com` defaults, not Apps Marketplace code.
  Unblock: A theme-marketplace owner needs to centralize those theme runtime public URLs through its environment contract, or explicitly authorize this mission to touch the theme runtime.
  Done anyway: App-marketplace, shared-types, billing-core, app-engine, api-client, api-gateway typecheck/build, app-marketplace lint/test/build, billing-core/app-engine tests, queue-worker typecheck/build/test, and latest Wave 9 marketplace/shared/api-client/gateway checks passed where touched.
