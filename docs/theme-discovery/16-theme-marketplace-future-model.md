# Theme Marketplace Future Model

> Research date: 2026-06-18
> Source files analysed: `apps/theme-marketplace/src/`, `services/api-gateway/src/lib/theme-marketplace-auxiliary-routes.ts`, `docs/theme-research/05-theme-marketplace-analysis.md`
> Status: frozen (`deploymentAuthority.platform = "frozen-not-deployed"`); ARB reopen required before any production deploy

---

## 1. Current Model Assessment

The marketplace is a structurally complete Shopify-style theme store that was implemented and then frozen before launch. The code reveals a **Model A bias** (traditional code-bundle marketplace) combined with early seeds of preset infrastructure, but neither model is fully realised.

**What is structurally present (code-complete):**

- Full browse/filter/search catalog (`themes` table — slug, category, pricing, industry, tags, features, version)
- Per-theme INR purchase via Razorpay with HMAC verification (`theme_purchases` table, 15% revenue share)
- Free theme install flow: store selection → gateway `store_themes` upsert → domain event
- Versioned release cycle: install → update detection (`version_installed` vs `theme.version`) → rollback by `release_id`
- Third-party developer pipeline: `theme_developer_listings` → local asset scan → `theme.developer_listing.submitted` domain event
- Download artifacts via `theme_download_artifacts` (signed URLs, object-store dependent in production)
- GST 18% receipt generation with `THEME_MARKETPLACE_GSTIN`
- Multi-platform support: `supported_platforms` field accepts `letbuyy`, `wordpress`, `html`, `react`
- `theme_preset_id` field on every `Theme` record linking to the theme-engine preset registry
- `color_presets` (named palette options), `customizable_sections`, `font_options` on every theme record

**What is absent or manually blocked:**

- No automated promotion pipeline from `theme_developer_listings` to the live `themes` table (review, approval, and publication are manual with no implemented workflow)
- No production deploy target, no Vercel project, no wired secrets
- No Lighthouse measurement job (performance/accessibility scores are empty)
- No Razorpay Route or UPI payout disbursement (defaults to `manual`, hardcoded dev note)
- No email notification backend for saved-search alerts
- `theme_preset_id` is stored but the preset layer is owned by `@letbuyy/theme-engine`, not the marketplace; the marketplace never creates or applies presets directly

**The current model is a traditional code-bundle marketplace with preset metadata plumbing installed but not activated.**

---

## 2. Three Models Compared

### Model A: Traditional Theme Marketplace

**What it is:** Third-party developers build and sell complete, self-contained themes as versioned code bundles. Each theme is an independent artifact. Merchants browse, purchase, download, and install the full bundle.

**How it works:** Browse → Purchase (Razorpay INR) → Download bundle (ZIP/JSON artifact) → Install to store → Customise via merchant editor → Version updates applied from marketplace

**Evidence of current leanings toward this model:**

- `theme_download_artifacts` table (per-theme download artifacts with checksum_sha256, size_bytes, storage_provider, delivery_status) — this is pure bundle-download infrastructure
- `theme_developer_listings.bundle_manifest` with `source`, `bundle_upload_status`, `zip_url`, `asset_urls`
- Bundle upload route (`POST /api/themes`, max 512 KB JSON) with local asset scan
- `version` field on `themes` + `version_installed` on `store_themes` + per-release rollback — full version lifecycle for independent artifacts
- `ThemeUploadPanel` component with direct JSON bundle upload
- 15% revenue share on per-purchase INR amounts — developer revenue split assumes paid, standalone artifact sales
- `theme_purchase_receipts` with GST invoice — legal artifact for a discrete transaction
- `changelog` field (version history entries) — each theme manages its own release notes
- `supported_platforms: ['letbuyy', 'wordpress', 'html', 'react']` — themes are platform-specific bundles
- Per-theme quality facts (Lighthouse scores): implies each bundle is independently measured

**DX Analysis:** High friction. Developers own the full rendering stack, must maintain compatibility with `@letbuyy/theme-engine` contracts, must implement accessibility and performance independently, and must manage their own release cadence. The local asset scan provides minimal quality gate. No automated code review or sandbox testing pipeline exists.

**Merchant Experience:** Maximum customisation — merchants get a completely different visual experience per theme. But switching themes is a destructive operation (replaces `store_themes` row), and content entered for one theme does not transfer to another. There is no migration path between themes.

**Maintenance Cost:** High and distributed. Every third-party developer maintains their own theme independently. When storefront-runtime adds a new section contract or breaks a rendering API, all third-party bundles potentially break. LetBuyy carries the platform contract stability burden; developers carry the implementation burden.

**AI Compatibility:** Poor. AI agents cannot generate a valid code bundle without deep knowledge of the `@letbuyy/theme-engine` Liquid/React rendering contracts, the sanitiser `FORBID` lists, and the JSON bundle schema. The bundle schema is validated in the gateway but not published as a machine-readable spec. AI cannot reliably apply a bundle to a store without knowing whether the installed Liquid renderer is enabled or disabled (the canary flag `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` is a storefront-runtime concern).

**Scalability:** Low. A realistic 10k-merchant catalog needs O(100s) of quality themes, each independently maintained. The developer listing → themes promotion pipeline has no automated step, meaning every new theme requires human moderation. The download artifact pipeline requires object-store infrastructure per bundle. The Lighthouse measurement job must run per-theme on every version update.

**Verdict:**
- Pros: Merchants can have genuinely distinct storefronts; developers have full creative control; established monetisation pattern (Shopify App Store model)
- Cons: High platform maintenance cost, no AI-native workflow, developer ecosystem cold-start problem (0 themes in database until manually seeded), version compatibility brittleness, no content migration between themes

---

### Model B: Preset Marketplace

**What it is:** A single LetBuyy Core Theme serves all storefronts. Developers and LetBuyy sell configuration presets (JSON data: color palette, font choices, layout selections, section order, copy). No code changes hands in a transaction.

**How it works:** Browse Presets → Apply Preset (writes `sites.template_config.themeSettings` via merchant editor API) → Customise within preset constraints

**Evidence of current leanings toward this model:**

- `theme_preset_id` field on every `Theme` record — the data model already stores a link to the preset registry in `@letbuyy/theme-engine`
- `color_presets` array on every `Theme` record: named palette options `{ name: string, colors: Record<string, string> }` — exactly what a preset marketplace would sell
- `customizable_sections: Record<string, unknown>` — per-theme section customisation map, lives in the `Theme` object, not the bundle
- `font_options: string[]` on every `Theme` record — font selection is preset-level, not code-level
- The install page collects a `preset` parameter (`default / conversion / editorial`) — this is preset-selection within a theme install, pointing toward a model where a single theme can be configured via presets
- `sites.template_config.themeSettings` in the merchant control plane is the live configuration field — it is already writable without a new bundle install
- `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` — the storefront currently defaults to the React rendering path, which is a single core renderer

**DX Analysis:** Low friction for preset authors. A preset is a JSON object: color tokens, font choices, section layout flags, section order. No rendering code required. Any developer who understands the `@letbuyy/theme-engine` section schema can author a valid preset. AI can generate a valid preset because the schema is bounded (colors, fonts, section config keys).

**Merchant Experience:** Consistent functional baseline across all merchants (core theme handles all commerce logic), fast time-to-value (apply preset = instant visual change, no install/bundle step), and content is preserved when switching presets. The constraint is that merchants cannot achieve radically different layouts that are outside the core theme's section library.

**Maintenance Cost:** Minimal and centralised. LetBuyy maintains one core theme; preset authors have no rendering responsibility. When storefront-runtime changes, only LetBuyy's core theme needs updating. Preset JSON is data — it does not break when the renderer is upgraded.

**AI Compatibility:** Excellent. An AI agent can generate a complete preset in one call (bounded schema: colors, fonts, section config). An AI agent can apply a preset by writing to `sites.template_config.themeSettings` via the merchant editor API. Preset generation is a structured data task, not a code generation task.

**Scalability:** Very high. A marketplace of 10k presets can be operated with zero developer code review because presets are pure data. Moderation is visual/semantic (does this preset look good?) rather than security-sensitive (does this code have XSS?). The `themes` table already stores `color_presets` and `customizable_sections` on each record — the DB schema is compatible with this model today.

**Verdict:**
- Pros: AI-native, minimal maintenance cost, fast merchant time-to-value, content persistence, horizontally scalable, no platform compatibility risk
- Cons: Limited visual differentiation between merchants using the same core theme, removes the ability for a merchant to have a truly unique layout outside core sections, developer revenue model is weaker (lower price point for a JSON preset vs a full theme bundle), less familiar to merchants trained on Shopify-style marketplace expectations

---

### Model C: Hybrid Marketplace

**What it is:** LetBuyy Core Theme provides the 80% baseline (commerce logic, mobile-first layout, COD/GST flows). Optional extension themes add vertical-specific section libraries (fashion, electronics, D2C, etc.) without replacing the core. A preset library configures everything — colors, fonts, section order, copy — within whatever section library is installed.

**How it works:** Browse Extension Themes (vertical-specific section packs, not full replacements) → Install Extension → Browse Presets (color/font/layout configurations for that extension) → Apply Preset → Customise within preset

**Evidence of current leanings toward this model:**

- The `theme_preset_id` linking to the engine's preset registry + `customizable_sections` + `color_presets` together describe a two-layer model: the bundle defines what sections exist; the preset configures how those sections look
- The install page's `preset` parameter (`default / conversion / editorial`) is exactly the Hybrid model's user flow: select a theme bundle variant, then select a preset within it
- `supported_platforms: ['letbuyy', 'wordpress', 'html', 'react']` — extensions could be platform-specific section packs
- The `theme_collections` table (manual/dynamic collections with `rule JSON`) maps to curated extension packs per vertical
- `industry: string[]` on each theme — already storing vertical metadata that would drive extension categorisation
- The `ThemeDeveloperListingInput.bundle_manifest.source` field shows the gateway expects bundles from various sources, consistent with extension packs
- ART-17 in CLAUDE.md: "forbids new React-per-section after freeze" — this is a constraint on adding sections to the core; it does not forbid extension themes from adding sections

**DX Analysis:** Medium friction. Developing an extension theme requires implementing the `@letbuyy/theme-engine` section contract for new section types only. Developers do not need to re-implement commerce logic. Preset authorship remains low-friction (JSON). Two developer personas: extension authors (section developers) and preset authors (designers/brand specialists).

**Merchant Experience:** Best of both models. Merchants get vertical-specific layouts (fashion store vs electronics vs D2C food brand) while the core handles all commerce. Preset switching preserves content. Switching extensions is rare (like switching industry); switching presets is frequent and safe.

**Maintenance Cost:** Medium. LetBuyy maintains the core theme and the section contract API. Extension authors maintain their section implementations. When the core changes, extension authors must update to new section contract versions. This is manageable with a versioned section schema and a compatibility matrix.

**AI Compatibility:** Good. AI can generate presets (bounded JSON data). AI can recommend which extension fits a merchant's vertical. AI could potentially scaffold a new section implementation given the section contract schema, though this requires code generation. Preset application via merchant editor API remains fully AI-actionable.

**Scalability:** High. The extension catalog is bounded by the number of verticals (realistic: 20-50 meaningful extensions vs hundreds of independent themes in Model A). The preset catalog scales independently to thousands. Total moderation load is lower than Model A because extension code is smaller scope (sections only), and preset moderation is data-level.

**Verdict:**
- Pros: Balanced developer opportunity, AI-actionable preset layer, vertical-specific merchant experience, strong content persistence, bounded maintenance scope
- Cons: More architectural complexity than Model B, requires the section contract API to be versioned and stable, extension authors still need rendering knowledge, the two-tier model (extension + preset) may confuse merchants unfamiliar with the concept

---

## 3. Evaluation Matrix

| Criterion | Weight | Model A (Bundle Marketplace) | Model B (Preset Marketplace) | Model C (Hybrid Marketplace) |
|---|---|---|---|---|
| Developer Experience | 15% | 4/10 — full bundle authorship, high barrier | 8/10 — JSON preset, minimal barrier | 7/10 — sections for extensions, JSON for presets |
| Maintenance Cost | 20% | 2/10 — O(N) themes each independently maintained | 9/10 — one core, preset data has no runtime risk | 7/10 — core + extension contract versioning |
| Merchant Experience | 20% | 7/10 — unique storefronts, but content migration pain | 6/10 — consistent baseline, limited differentiation | 8/10 — vertical layouts + content persistence |
| AI Compatibility | 15% | 2/10 — code bundle generation is unsafe/brittle | 10/10 — preset generation is a bounded structured task | 8/10 — preset layer is AI-native; extension requires code |
| Scalability to 10k merchants | 10% | 3/10 — catalog seeding bottleneck, manual review pipeline | 9/10 — preset moderation is data-level, no code review | 8/10 — extension catalog is small, preset catalog scales |
| Time to First Value for Merchant | 10% | 4/10 — install + bundle download + activation steps | 9/10 — apply preset = instant config write | 7/10 — install extension + apply preset, two steps |
| Revenue Potential | 10% | 8/10 — high per-unit prices for full themes possible | 5/10 — preset price points are lower, volume-dependent | 8/10 — extension pricing comparable to theme bundles; preset upsell |
| **Weighted Total** | **100%** | **3.85/10** | **8.05/10** | **7.55/10** |

Score methodology: each criterion scored 1-10; multiplied by weight; summed. Model B leads by 0.5 points over Model C due to lower maintenance cost and superior AI compatibility.

---

## 4. India-First Commerce Considerations

**GST compliance:** The current code already implements GST correctly for theme purchases (18% server-side, `theme_purchase_receipts` with `THEME_MARKETPLACE_GSTIN`). This is model-agnostic — it applies equally to a ₹999 bundle purchase and a ₹199 preset purchase. The GST invoice generation is in the gateway and requires no model-specific change.

**COD:** COD is a storefront-runtime checkout concern (`storefront-runtime`), not a theme marketplace concern. All three models are COD-compatible because the theme marketplace does not participate in order checkout.

**Mobile-first requirement (~360px):** Model B and Model C have a structural advantage. A single core theme can be optimised once for 360px viewports using `--lb-*` design tokens. In Model A, every third-party developer must independently implement mobile-first breakpoints and use the token system correctly — the platform cannot enforce this without a full UI review of each bundle. The install page and catalog already respect mobile-first constraints because they are part of the marketplace UI, not the themes themselves.

**Local payment methods:** Razorpay INR checkout is already implemented for theme purchases in all models. This is marketplace infrastructure, not theme-model-specific.

**Vernacular content (Hindi, Tamil, Telugu, etc.):** This is a content concern, not a theme structure concern. In Model A, third-party theme bundles may hardcode English strings without i18n support — the platform has no enforcement mechanism. In Model B and C, the core theme can implement i18n once and all preset configurations inherit it. Vernacular content becomes a preset-level concern (swapping copy presets per locale), not a bundle-level concern.

**Fashion and D2C India verticals:** India's D2C market (apparel, FMCG, electronics accessories) is heavily vertical-specific. A single core theme optimised for generic commerce cannot capture the visual language of a Meesho-style fashion catalog vs a D2C food brand. This is the core argument for Model C's extension layer over Model B's flat preset model — vertical-specific section packs (masonry product grid for fashion, subscription box upsell for food, spec comparison table for electronics) are meaningfully different layout capabilities, not just color/font variations.

**Low-bandwidth environments:** The `theme_download_artifacts` pipeline in Model A requires merchants to download ZIP bundles via signed URLs from object storage. In low-bandwidth markets, bundle delivery reliability is a real concern. Model B eliminates bundle downloads entirely — applying a preset writes a JSON config row. Model C reduces the download to extension section packs only (smaller than full theme bundles).

---

## 5. Recommendation

**Recommended model: Model C (Hybrid Marketplace), with Model B as the initial delivery phase.**

The evidence in the codebase points to Model C as the intended architecture: `theme_preset_id` links to the engine's preset registry, `color_presets` and `customizable_sections` are first-class fields on every `Theme` record, the install flow already collects a `preset` parameter, and the `industry` array on each theme maps directly to extension vertical categorisation. The data model is already Model C-shaped.

However, Model C cannot be built first because the extension theme section contract does not exist yet (ART-17 froze new React sections during the freeze), the developer listing to themes promotion pipeline has no automated step, and the marketplace is not deployed. Building the full hybrid model before first launch would extend the time before any merchant gets value.

The correct sequence is:

1. **Phase 0 (prerequisite):** ARB reopen decision; provision Vercel project; wire secrets (`LETBUYY_API_URL`, `INTERNAL_API_SECRET`, `THEME_MARKETPLACE_GSTIN`, Razorpay keys)
2. **Phase 1 (Model B delivery):** Launch with a preset marketplace. Seed the `themes` table with LetBuyy-authored presets (color + font + section config bundles, no third-party code). Use the existing `color_presets` and `customizable_sections` fields. The existing install flow applies the selected preset via `config_overrides` in `ThemeService.installTheme`. No bundle download infrastructure required. No developer listing review pipeline required.
3. **Phase 2 (Model C extension layer):** Define a versioned section contract schema. Allow third-party developers to submit extension section packs via the `theme_developer_listings` pipeline. Implement the automated promotion pipeline (listing → review → `themes` table). Launch an extension marketplace alongside the existing preset marketplace.

**Why not Model B permanently:** The India D2C vertical differentiation need (fashion vs food vs electronics vs services) cannot be met by color/font presets alone. The `industry` field and extension architecture are already in the data model for a reason. Model B is the right first phase, not the permanent ceiling.

**Why not Model A:** The evidence against it is structural. The developer listing → themes promotion pipeline has no automated review step, making catalog seeding a manual bottleneck. The download artifact pipeline requires object-store infrastructure that is not yet wired. The Lighthouse measurement job does not exist. Every one of these gaps is a launch blocker for Model A, while none of them are launch blockers for Model B.

---

## 6. Implementation Path for Recommended Model

Given the frozen marketplace state, the following ordered steps apply:

**Phase 0 — Unfreeze (ARB required)**

1. Submit ARB reopen request with deployment scope: Vercel project for `apps/theme-marketplace`, subdomain `themes.letbuyy.com` or `marketplace.letbuyy.com`
2. Update `runtime.manifest.json`: `deploymentAuthority.platform` from `"frozen-not-deployed"` to `"vercel"` and `environmentAuthority.secretStore` from `"none"` to `"vercel"`
3. Provision Vercel project; configure environment: `LETBUYY_API_URL`, `INTERNAL_API_SECRET`, `LETBUYY_MERCHANT_SESSION_COOKIE` secret name, `THEME_MARKETPLACE_GSTIN`, `RAZORPAY_KEY_ID` (in gateway env, not marketplace env), `NEXT_PUBLIC_API_URL`
4. Run `node scripts/validate-governance.mjs` to confirm topology is consistent

**Phase 1 — Model B: Preset Marketplace Launch**

5. Seed `themes` table with 5-10 LetBuyy-authored presets per category (store, portfolio, landing at minimum). Each row populates: `slug`, `name`, `category`, `industry`, `letbuyy_pricing_type` (free or one_time), `letbuyy_price_inr`, `color_presets` (3-5 named palettes), `customizable_sections` (section config map), `font_options`, `is_active: true`
6. Seed `theme_collections` table with curated collection rows (e.g., "Fashion Stores", "D2C Food Brands", "Service Businesses")
7. Wire real `THEME_MARKETPLACE_GSTIN` — the gateway blocks receipt generation without it; this is a hard launch blocker for paid presets
8. Confirm the install flow's `preset` parameter flows correctly through `ThemeService.installTheme` → `config_overrides` → gateway → `store_themes.config_overrides` → merchant editor reads `config_overrides` and applies to `sites.template_config.themeSettings`
9. Implement storage provider for `theme_download_artifacts` — even for presets, a downloadable JSON artifact (the preset config) is useful for advanced merchants; wire R2 or S3 with real signed URLs
10. Implement Razorpay payout for developer revenue share — the `payout_provider: 'manual'` default must be replaced with Razorpay Route or UPI before any third-party developer can be paid

**Phase 2 — Model C: Extension Layer**

11. Define the versioned section contract schema: a JSON Schema document specifying the interface an extension section must implement to be compatible with the core theme renderer. Publish this as a developer-facing API document.
12. Implement the developer listing → themes promotion pipeline: a moderation queue (operator UI in `apps/platform-console`) that shows submitted listings, allows approval/rejection, and on approval writes a new row to `themes` with `is_active: true`. The domain event `theme.developer_listing.submitted` is already emitted — add a consumer in `queue-workers` that triggers the moderation queue entry.
13. Implement the Lighthouse measurement job: a Playwright/Puppeteer job that runs against the `demo_url` of each approved theme and writes `performance_report.lighthouse_performance` and `accessibility_report.lighthouse_accessibility` to the `themes` row. This is a `queue-workers` job triggered by the `theme.approved` domain event.
14. Implement email notifications for saved-search alerts via the existing `notification-service` reserved service (or Resend directly) — `alerts_enabled` on `theme_saved_searches` already stores the preference; the delivery backend is the missing piece.
15. Update `AGENTS.md` in `apps/theme-marketplace` to reflect the new deployment authority and model classification once Phase 0 ARB approval lands.

**Tables that require no schema changes for Phase 1:** `themes`, `store_themes`, `theme_purchases`, `theme_purchase_receipts`, `theme_collections`, `theme_collection_items`, `theme_marketplace_settings`, `theme_saved_searches`

**Tables added or extended for Phase 2:** `theme_developer_listings` (already exists; add `approved_at`, `approved_by` columns for the moderation workflow); `theme_download_artifacts` (already exists; wire real storage provider); a new `theme_moderation_queue` table or operator-UI view for the approval workflow.
