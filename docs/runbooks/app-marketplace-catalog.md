# App Marketplace Catalog Runbook

Owner: App Marketplace operations, with `services/api-gateway` as the catalog writer.

1. Review candidate app, category, collection, featured placement, and media changes against the current `marketplace_apps`, `app_categories`, `app_collections`, `app_collection_items`, and `app_featured_placements` contracts.
2. Confirm every public badge or rail is backed by stored data. Do not publish fake ratings, fake installs, placeholder screenshots, or undisclosed sponsored placements.
3. For first-party demo apps, set clear first-party/demo metadata and keep install, review, and rating counts at the real stored values.
4. For launch-partner apps, require approved developer identity, pricing plan, support SLA, data-handling disclosure, at least one screenshot, and review approval before publishing.
5. After a catalog mutation, check `/v1/app-store/apps`, `/v1/app-store/categories`, `/v1/app-store/collections`, and `/v1/app-store/growth/new-this-week` for expected counts.
6. Run the app-marketplace build and `node scripts/validate-governance.mjs` before announcing a catalog launch.
7. Escalate to legal/business owners before changing revenue-share copy, sponsored inventory rules, partner launch content, or public policy wording.
