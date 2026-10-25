# App Marketplace Catalog Runbook

> Frozen seam runbook. The public app marketplace is not an active production surface; use this only for first-party/private sandbox catalog evidence until an ARB-approved marketplace reopen trigger exists.

Owner: App Marketplace operations, with `services/api-gateway` as the catalog writer.

1. Review candidate app, category, collection, featured placement, and media changes against the current `marketplace_apps`, `app_categories`, `app_collections`, `app_collection_items`, and `app_featured_placements` contracts.
2. Confirm every public badge or rail is backed by stored data. Do not publish fake ratings, fake installs, placeholder screenshots, or undisclosed sponsored placements.
3. For first-party demo apps, set clear first-party/demo metadata and keep install, review, and rating counts at the real stored values.
4. For launch-partner apps, require approved developer identity, pricing plan, support SLA, data-handling disclosure, at least one screenshot, and review approval before publishing.
5. After a catalog mutation, check `/v1/app-store/apps`, `/v1/app-store/categories`, `/v1/app-store/collections`, and `/v1/app-store/growth/new-this-week` for expected counts.
6. Run the app-marketplace build and `node scripts/validate-governance.mjs` before announcing a catalog launch.
7. Escalate to legal/business owners before changing revenue-share copy, sponsored inventory rules, partner launch content, or public policy wording.

## Local installation acceptance

The default `FEATURE_APP_PLATFORM` gate returns `APP_PLATFORM_DISABLED`. An explicitly authorized local sandbox may enable it in its private, generated Worker configuration; this does not change the tracked production default or reopen the frozen marketplace.

Use the canonical Identity login, an owned synthetic store, and clearly labeled demo apps. Select the target store in install consent and retain its `store_id` when opening My Apps and changing installation configuration. The app's registered OAuth callback can differ from its launch URL. Internal session headers must be signed separately for each API request because their JTI is single-use; preserve the business idempotency key when retrying an interrupted mutation.

If an embedded provider needs a separate origin, configure `APP_EMBED_ALLOWED_ORIGINS` with exact HTTPS origins in the private local app environment. This grants frame permission only. A local provider mock proves installation and permission behavior, not the external provider's integration. Keep private credentials out of frames, screenshots and reports.

The executable marketplace acceptance suite creates its own synthetic app, developer, actors and stores in a disposable owned database. It checks the default-off gate, UUID/slug lookup, anonymous review RLS and redaction, forbidden tenants/scopes/callbacks, concurrent single-use PKCE redemption, fresh request credentials, scope revocation, uninstall replay and token revocation, and theme installation/rollback state:

```sh
node --test tests/governance/gateway-db-lane.test.mjs
node scripts/governance/run-executable-suites.mjs --filter marketplace-installation --jobs 1
pnpm --filter @letbuyy/app-marketplace test
pnpm --filter @letbuyy/theme-marketplace test
pnpm --filter @letbuyy/app-marketplace build
pnpm --filter @letbuyy/theme-marketplace build
```

Use a checkout without private app environment files for owned browser acceptance. Alongside these database checks, exercise the actual local UI: install to the chosen store, launch the labeled provider fixture, read products through the scoped bridge, uninstall/retry after a lost response, reinstall, install two theme releases, roll back with the normal pointer control, and visit the resulting storefront. Keep the browser result, negative controls, exact source identity and owned-resource cleanup evidence together. Root build/typecheck commands exclude the frozen marketplaces, so their explicit checks above are required for this sandbox work.
