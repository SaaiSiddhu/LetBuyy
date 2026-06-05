# 09 — Theme Marketplace Specification (Phase 7)

Target: Shopify-Theme-Store-class distribution. Baseline: `apps/theme-marketplace` (real app: browse/detail/pricing/checkout/dashboard), DB model already versioned (`theme_packages → theme_package_versions → theme_instances → theme_releases`), install + private upload endpoints exist, ops review decision route exists. Missing: the whole supply side (submission→validation→signing→publish), export/import/clone/update flows, revenue share. (Gap IDs V-22…V-25.)

---

## 1. Theme Package Format (canonical, signed)

Distribution artifact = **zip** of the Liquid bundle (doc 06 §2) + manifest:

```
package.zip
├── theme.json                  # NEW manifest (below)
├── layout/  templates/  sections/  blocks/  snippets/  assets/  config/  locales/
```

`theme.json`:
```json
{
  "schema_version": "2026-06-liquid-sections",        // EXISTS constant
  "name": "Urban Kicks", "slug": "urban-kicks",
  "version": "1.4.2",                                  // semver, matches theme_package_versions
  "author": {"developer_id": "...", "name": "...", "url": "..."},
  "compatibility": {"engine": ">=2.0 <3", "min_platform": "2026-06"},
  "site_types": ["store"],                             // tenant-core SiteType enum EXISTS
  "presets": ["default", "dark"],                      // must exist in settings_data
  "screenshots": ["assets/preview-home.png"],
  "license": "letbuyy-marketplace-v1",
  "checksum_alg": "sha256", "files": {"layout/theme.liquid": "sha256:..."},
  "signature": "ed25519:..."                           // platform-signed at publish
}
```

## 2. Lifecycle State Machines (DB columns EXIST)

```
theme_packages.status:            draft → active ↔ disabled → archived
theme_package_versions.release_status: draft → in_review → published → deprecated → revoked
                                          (in_review = NEW enum value; rest EXIST)
theme_instances.instance_status:  installed → active ↔ inactive → upgrading → archived (EXIST; wire 'upgrading')
```

## 3. Submission → Review → Publish Pipeline (BUILD)

```mermaid
flowchart LR
  DEV[Developer] -->|POST /v1/theme-packages/:slug/versions zip| VAL[Automated validation]
  VAL -->|pass| REV[in_review queue]
  VAL -->|fail| DEV
  REV -->|ops decision route EXISTS: /v1/operations/marketplace-reviews/:id/decision| SIGN[Platform signing ed25519]
  SIGN --> PUB[release_status=published + listing live]
  PUB --> CDN[(R2: packages/{slug}/{ver}/package.zip + extracted assets)]
```

**Automated validation (letbuyy-theme-check):** Zod bundle parse (EXISTS: `LiquidThemePackageBundleSchema`); every section has `{% schema %}` (EXISTS); forbidden-fragment scan (EXISTS); NEW: liquid parse of every file under engine limits, render smoke vs. synthetic store context, settings_schema⇄settings_data consistency, asset size/type limits (doc 07 §9), screenshot presence, semver monotonicity, a11y lint (img alt, heading order), perf budget (rendered fixture ≤ 150 KB HTML). Results stored on version row (`validation_report jsonb` — ADD column).

**Review/moderation:** human queue in platform-console (route exists server-side; BUILD the console UI); checklist (originality, content policy, trademark); decision → approve/reject with notes; `theme_reviews` table EXISTS for user ratings — keep separate from moderation (`marketplace_reviews` ops flow).

**Signing:** platform Ed25519 key (KMS/secret-stored); signature over file-checksum map; verified at install + at render-bundle load. Revocation: `revoked` status + signature denylist → installed instances pinned (keep working) but flagged in admin; new installs blocked.

## 4. Merchant Flows

| Flow | Endpoint(s) | Status |
|---|---|---|
| Install (free) | `POST /v1/themes/:slug/install {store_id}` | EXISTS → add signature verify + entitlement check |
| Purchase (paid) | theme-marketplace checkout → `theme_purchases` (EXISTS) → install grant | EXTEND (license rows per store) |
| Private upload | `themes.uploadPackage(bundle,'private_install')` | EXISTS → route through same validation, unsigned-private flag |
| **Update** | `POST /v1/theme-instances/:id/upgrade {to_version}` → status `upgrading` → migrate settings (below) → new draft for review → merchant publishes | BUILD |
| Rollback | releases rollback chain | EXISTS |
| **Duplicate** | `POST /v1/theme-instances/:id/duplicate` → copy instance+draft (unpublished) | BUILD |
| **Export** | `GET /v1/theme-instances/:id/export` → zip of current release w/ merchant settings_data | BUILD (schema designed for it: `PortableThemePackageBundleSchema` EXISTS) |
| **Import** | `POST /v1/theme-instances/import` (zip) → validation → private instance | BUILD |
| Clone/Fork (dev) | `POST /v1/theme-packages/:slug/fork` → new draft package owned by developer, lineage recorded (`forked_from_version_id` ADD) | BUILD |
| Preview before install | demo store render w/ package preview token | BUILD-lite (preview-session mechanism EXISTS) |

**Settings migration on update:** diff old↔new `settings_schema`; carried = same id+type; renamed via `theme.json migrations[]` map (`theme_migrations` table EXISTS, unused — wire it); dropped → archived in draft metadata; new → defaults. Never auto-publish an upgrade.

## 5. Versioning Rules

Semver enforced per `theme_package_versions` (EXISTS). Breaking (major): removed section types, removed settings ids, layout contract changes. Platform engine compatibility via `compatibility.engine` checked at install/upgrade. Each store install pins exact version (`theme_instances` → version FK EXISTS); platform never force-upgrades; security revocation = flag + merchant notice, not silent swap.

## 6. Revenue Sharing (BUILD — V-25)

Reuse billing primitives (`billing-core`, `payment_transactions`, Razorpay/Stripe adapters):

```
developer_accounts        NEW (kyc_status, payout_method, gstin — GstinSchema EXISTS)
marketplace_sales         NEW (theme_purchase_id FK EXISTS table, gross, platform_fee, tax, net, currency=INR)
developer_payout_batches  NEW (period, status, provider_ref)
```
Policy v1: 80/20 split after payment fees; monthly payout ≥ ₹2,000 threshold; GST invoice per sale (invoice plumbing EXISTS on orders — replicate for marketplace sales). Refund window claws back `marketplace_sales` rows (refund tables EXIST).

## 7. Marketplace App Surface (apps/theme-marketplace) — Build List

EXISTS: catalog, detail, checkout, purchaser dashboard. BUILD: developer area (submit version w/ upload + validation report display, version list, payout dashboard) — or route developers through `apps/developer-portal` (preferred: portal already reserved for dev tooling; keep theme-marketplace consumer-only). Listing pages add: live demo link, version changelog, compatibility badges, review stars from `theme_reviews` (EXISTS).

## 8. Governance Alignment

`docs/governance/theme-engine-governance.md` holds: marketplace owns **acquisition only**, never rendering. All render-path code stays in theme-engine/storefront-runtime. The validation pipeline runs in gateway/worker context (or dedicated `theme-validation` queue consumer on existing SEARCH/RUNTIME queue infra) — not in the marketplace app. CDN distribution from R2 via media-service (doc 18).

## 9. Acceptance Criteria

A third-party developer can: fork the default theme → edit locally → upload → pass automated checks → get human-approved → publish v1.0.0 → a merchant installs, customizes, exports their copy → developer ships v1.1.0 → merchant upgrades with settings preserved → developer sees the sale and a payout accrual. Every arrow above exists as an endpoint with tests.
