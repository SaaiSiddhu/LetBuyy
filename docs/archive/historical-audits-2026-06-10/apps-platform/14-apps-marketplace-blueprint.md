# Apps Marketplace Architecture Specification (Phase 13)

Target: Shopify-App-Store-grade marketplace on existing rails (`apps/app-marketplace` UI + gateway `app-store` modules + Supabase). Covers publishing, versioning, installation, updates, rollback, deprecation, reviews, ratings, billing, revenue share, analytics, moderation.

---

## 1. Publishing & Versioning
- `app_versions` (new; doc 16): `(app_id, semver, changelog, manifest jsonb, tae_extension_id, status, submitted_at, reviewed_by, published_at)`; `marketplace_apps` keeps listing-level data (name, slug, tagline, category, pricing summary, media).
- Listing content versioned too: `app_listing_revisions` (screenshots [3–6, validated dimensions], demo URL, description, support contacts, privacy policy URL — submission blockers if absent, mirroring App Store requirements).
- Publish gates (all machine-checked before human review): TAE validation pass (doc 11 §3), compliance webhook handlers verified via challenge delivery (H12), OAuth redirect URIs https, billing config sane, listing completeness.

## 2. Review & Moderation Workflow (platform-console)
State machine (doc 10 §4) with reviewer tooling:
- Queue views: submitted / in_review (assigned) / changes_requested aging.
- Checklist per review (security, scopes-justification, listing quality, webhook challenge results, TAE smoke renders) persisted as `app_review_artifacts` — auditable approvals.
- Moderation actions: suspend listing (`marketplace_apps.status='suspended'`), revoke extension (edge kill switch, doc 13 §4), force-uninstall offer to merchants with notice, developer communication thread.
- Reviews/ratings moderation: flag queue for `app_reviews` (verified-install reviewers only: review writes require an active installation — enforced at `POST /apps/:id/reviews` which already requires auth; add installation check), report-abuse endpoint, response-by-developer field.
- Consolidation: drop `marketplace_review_records` (doc 08 Batch 3).

## 3. Installation / Updates / Rollback / Deprecation
- Install: consent screen (scopes + privacy + billing summary) → install txn writes installation + grant + pinned version + offline token → post-install redirect contract (`return_url` whitelisted to app's registered domains).
- Updates: minor (no scope/billing change) auto-available, merchant 1-click; scope-expanding updates require re-consent (grant row versioned); billing-changing updates require charge re-approval.
- Rollback: merchant-level re-pin to previous version (≤2 versions back, if not security-revoked); platform-level bulk rollback job.
- Deprecation: developer marks version deprecated (install-blocked, existing keep working) or app sunset flow: 90-day notice → install-blocked → scheduled uninstall with merchant notifications via notification-core.

## 4. Billing & Revenue Share
- Plans on listing: free / one_time / recurring (monthly|annual, trial_days) / usage (meter, capped_amount) — `app_pricing_plans` table; checkout via existing charge endpoints extended with `app_subscriptions` (doc 16).
- Merchant approval UX in control-plane (today only API exists, doc 06 §1).
- Revenue share: nightly job aggregates settled app charges → `partner_payout_ledger_entries` (table exists, baseline:10225) with `platform_fee_bps` (configurable per developer tier) → payout batches (`payout.released/failed` events finally get a producer) → statements visible in developer portal.
- Refunds: platform-initiated app-charge refunds create negative ledger entries; dunning for `past_due` subscriptions (3 retries → suspend installation billing state).

## 5. Discovery & Analytics
- Catalog: categories (exists), collections/staff picks (`marketplace_collections`), search with installs/rating ranking, "works with your theme" badge (TAE present), pricing filters (exists).
- Attribution: `app_install_events` (source: search|category|collection|direct) feeding developer analytics.
- Developer metrics (portal): installs, uninstalls (+survey reason enum), active installs, conversion, MRR, webhook failure rate, block render error rate (from storefront events doc 12 §3.4).
- Merchant trust surfaces: scopes displayed pre-install, data-use disclosure, uninstall data-retention statement (from listing fields).

## 6. API Surface (delta on existing endpoints)
Existing kept: categories, apps list/detail, reviews GET/POST, installations, install/uninstall, charges, oauth, developers, partners.
Added: `POST /developers/apps/:id/versions` (+`/versions/:v/submit`), `GET /apps/:id/versions`, `PATCH /installations/:id/pin`, `POST /apps/:id/listing-revisions`, `GET /review-queue` (+`POST /review-queue/:id/{assign,approve,request-changes,reject}` — ops-role gated), `POST /reviews/:id/report`, `GET /developers/apps/:id/analytics`, placements/embeds modules (doc 11 §9), app-proxy (doc 13 §2).
All marketplace reads keep working through `apps/app-marketplace` thin client — **fix silent-fallback first** (doc 09 B1) so the storefront of the App Store is honest.

## 7. Non-Goals (v1)
No paid placement/ads; no multi-currency payouts (INR+USD only, matching existing billing fields); no app bundles; no in-admin embedded app store (separate origin stays).
