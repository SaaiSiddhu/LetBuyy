# 5. Theme Marketplace Operations Report

## Lifecycle State Machines

| Entity | States |
|---|---|
| `theme_packages.status` | `draft \| active \| disabled \| archived` |
| `theme_package_versions.release_status` | `draft \| published \| deprecated \| revoked` |
| `marketplace_review_records.status` | `pending \| in_review \| approved \| rejected \| changes_requested` |
| `theme_purchases.status` | `pending \| completed \| refunded \| failed` |
| `theme_reviews.status` (merchant ratings) | `published \| pending \| rejected` |
| `theme_instances.instance_status` | `installed \| active \| inactive \| upgrading \| archived` |
| `theme_releases.release_status` | `published \| superseded \| rolled_back` |

All in `database/supabase/migrations/000_baseline.sql`.

## Workflow Verdicts

### Theme Submission — PARTIAL (API-only)
`POST /themes/packages/upload` (`services/api-gateway/src/routes/themes.ts:489-557`): validates bundle via `UploadThemePackageSchema` from `@letbuyy/theme-engine`, supports `submission_mode: 'marketplace' | 'private_install'`; marketplace mode auto-creates a review record with automated checks (`bundle_schema_validation`, `theme_package_persistence`) and emits `theme.submitted`. **No designer-facing submission UI exists** — submission requires direct API calls.

### Theme Review — PARTIAL
Same queue + decision pipeline as apps (report 4). Decision cascades (`operations.ts:320-383`): approved → `theme_packages.status='active'` + version published + `themes.is_active=true`; rejected → `disabled`; changes_requested → `draft`. Events `theme.approved|rejected|changes_requested` emitted with idempotency keys.
**Missing for a competent review:** theme preview environment, Liquid/JS code inspection, screenshot/visual diff between versions, accessibility (WCAG) checks, performance checks — notable because the seeded renderer manifest *defines* budgets (LCP 2500ms, max initial JS 180KB, max image 350KB in `urban-kicks-theme.sql`) that no automated check enforces at submission.

### Theme Approval / Rejection — EXISTS (one-step, super-admin only)

### Theme Updates — PARTIAL
Versioning + reversible migrations exist (`theme_migrations` with `migration_manifest`/`rollback_manifest`, `is_reversible`). New versions flow through review. No auto-update push; merchants re-install. No staged rollout, no update-failure telemetry.

### Theme Moderation — MISSING
No delist/takedown after approval (decision endpoint only operates on review records; no unpublish action), no malware/script scanning, no abuse reporting against themes, no emergency version revocation UI (`release_status='revoked'` exists in schema only).

### Theme Analytics — MISSING
`themes.install_count` + rating triggers exist. No dashboards: no installs-over-time, actives by version, conversion, revenue by theme, author-facing stats.

### Theme Revenue — PARTIAL
Purchases fully implemented (free path + Razorpay order/verify, license keys, INR/USD prices). **Payout side unconnected:** `partner_payout_ledger_entries` exists but nothing maps `theme_purchases` → ledger entries; no theme-author payout identity (purchases lack `partner_id` linkage); `rail` defaults to `manual`.

## Catalog Reality
Exactly one theme exists: **Urban Kicks v1.0.0**, first-party (`author_name='LetBuyy'`), free, 18 sections / 8 blocks / 11 templates, seeded via `database/supabase/seeds/urban-kicks-theme.sql`; `database/supabase/verification/055_only_urban_kicks_theme_catalog.sql` enforces single-theme catalog. The marketplace is operationally a distribution mechanism for one in-house theme; external author operations are untested end-to-end.

## Can a Theme Reviewer do the job today?
**Mechanically yes, substantively no.** They can see queue entries and click approve/reject with a reason. They cannot see the theme rendered, read its code, or verify safety/performance/accessibility — approving a marketplace theme today is signing off on a name and two schema checks. And once approved, there is no way to take it down from any UI.

## Top Gaps (priority order)
1. Theme preview link/environment in the review queue
2. Automated checks enforcing the already-defined performance budgets + code safety scanning
3. Designer submission portal (upload UI, status tracking, resubmission)
4. Delist/revoke-version capability post-approval
5. Purchase→payout ledger automation and author payout identity
6. Theme ops analytics (installs, actives, revenue, version adoption)
