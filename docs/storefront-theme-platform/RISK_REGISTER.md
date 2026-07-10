# M→AE Program — Risk Register

Living register. Each entry: ID · severity · status · evidence · owner/target phase.

## Security / tenancy

### RISK-SEC-001 — `theme_purchases` has wide-open RLS (`USING (true)` / `WITH CHECK (true)`) — [HIGH]
- **Status:** OPEN · pre-existing baseline (NOT introduced by M→AE).
- **Evidence:** `database/supabase/migrations/000_baseline.sql` — `theme_purchases` table at `:12820`; RLS policies `USING (true)` at `:24201` and `WITH CHECK (true)` at `:24159` (surfaced by the Phase M security-tenancy inventory, claim CL-20, verified).
- **Why it matters:** violates the tenancy invariant (no public `USING (true)` on tenant tables). `theme_purchases` is marketplace-domain; the marketplace apps are FROZEN, so no live route currently exposes it, which bounds the blast radius today — but any future route over this table would leak cross-tenant purchase rows.
- **Disposition:** documented, NOT patched in Phase M (discovery phase, no source edits). A baseline RLS change is a security-domain migration requiring care + review. **Target: Phase AE** (marketplace/entitlement contracts) or an earlier dedicated security migration, gated by the same cross-tenant negative tests the program mandates. Owner: whoever owns marketplace persistence + ARB, since it touches a frozen domain's data.
- **Do NOT:** add a route over `theme_purchases` in any earlier phase until this policy is scoped by `site_id`.

### RISK-SEC-002 — Editor AI hooks are STUB, must not be presented as connected — [INFO]
- **Status:** KNOWN · by design.
- **Evidence:** merchant editor `applyAiHook()` sets hardcoded strings/values; no fetch to any AI service; Phase L `ai-*` packages are not imported by the editor page (Phase M merchant-editor + docs-reconciliation inventory).
- **Disposition:** Phase AC must wire the deterministic `ThemeAiChangePlan` pipeline and mark provider execution `NOT_CONNECTED` (no approved model provider found). Never label the editor's AI as connected.

## Governance / build

### RISK-GOV-001 — `validate-governance.mjs` fails on pre-existing tenant-registry drift — [MEDIUM]
- **Status:** OPEN · pre-existing FOREIGN WIP (NOT a theme-program failure).
- **Evidence:** `node scripts/validate-governance.mjs` EXIT=1; sole failure = `services/api-gateway/src/tenant/tenant-tables.registry.ts` out of sync with schema-derived registry (`run scripts/generators/generate-tenant-table-registry.mjs`). Anti-fabrication gate PASSES (1260 files, 0 fabricated).
- **Why it matters for M→AE:** Phases **P** and **W** add new theme tenant tables (drafts/revisions, custom-data). Those additions MUST be registered so they add **no new** tenant-isolation violation. Regenerating the registry may pull in foreign schema WIP, so registry changes must be staged surgically (only the program's own table rows) or the generator run and its diff reviewed against program scope.
- **Owner:** foreign — whoever holds the uncommitted tenant-schema WIP. Program will not fix foreign drift; it will avoid adding to it.

## Data / migrations

### RISK-DATA-001 — Migrations 186/187 are untracked WIP; 188 requires production apply — [MEDIUM]
- **Status:** OPEN · foreign (186/187) + committed-but-unapplied (188).
- **Evidence:** `git log -- database/supabase/migrations/186_*.sql` and `187_*.sql` return empty (untracked). `188_letbuyy_core_theme_row.sql` committed in `40741cb8` (idempotent `INSERT … ON CONFLICT (slug) DO NOTHING`); the `letbuyy-core` DB row does not exist until 188 runs against the DB. Migration 187 (`sites.site_settings`) is referenced by `storefront-runtime` `mapSupabaseToStore` — a real deployment risk if the DB is reset before it is committed/applied.
- **Disposition:** program authors migrations for its own phases and tests them locally/staging only; it does NOT apply migrations to production and does NOT commit foreign migrations 186/187.

## Phase O risks

### RISK-O01 — Nova/Summit structural distinctness collapses if `cta-section` is removed from the bundle — [LOW]
- **Status:** OPEN · ongoing process requirement.
- **Introduced:** Phase O (2026-07-10).
- **Evidence:** `NOVA_COMPOSITIONS.index` includes `ctaSection` (maps to `cta-section`) as its distinguishing section vs Summit's 6-section baseline. `cta-section` is present in the Urban Kicks bundle today via `createLiquidParitySectionFiles()` as part of `THEME_LIQUID_PORTABLE_SECTION_PARITY`. If `cta-section` were removed from that set, Nova's spec would become `'incompatible'` and the post-apply fingerprints of Nova and Summit would be identical (both would result in 6 bare sections).
- **Why it matters:** Structural distinctness is verified by test (`'all 10 experiences produce structurally distinct index templates after COMPLETE_DESIGN'`). If this test fails due to a bundle change, it is a signal that Nova needs a new structural differentiator.
- **Disposition:** Any change to the Liquid parity section set that removes or renames `cta-section` must re-evaluate Nova's composition. Nova could be differentiated by `aboutSection` or `brandMarquee` as alternatives if `ctaSection` becomes unavailable.
- **Target:** Any phase modifying `createLiquidParitySectionFiles()` or the parity section set.

### RISK-O02 — `collectionFilter` and `faqAccordion` compositions are permanently advisory until bundle expanded — [LOW]
- **Status:** OPEN · known gap, not a bug.
- **Introduced:** Phase O (2026-07-10).
- **Evidence:** `collection-filter.liquid` and `faq-accordion.liquid` are absent from the Urban Kicks / LetBuyy Core bundle's `section_definitions`. All 10 collection compositions include `collectionFilter`; Craft's index and product compositions include `faqAccordion`. These specs produce `'incompatible'` diff entries and are skipped by the apply engine without failing. The remaining compatible sections apply correctly.
- **Why it matters:** Until these section files are added to the bundle, collection template compositions are always partially applied (filter control is not added). Merchant-facing collection pages created via `applyExperienceToDocument` will not have a built-in filter section. The diff informs callers of this via `'incompatible'` entries with descriptive `incompatibleReason` strings.
- **Disposition:** Adding the two section definition files to the Urban Kicks / LetBuyy Core bundle in a future bundle-expansion phase would automatically make all collection filter and craft FAQ compositions fully compatible — no changes to Phase O code required. Until then, the advisory diff entries ensure transparency.
- **Target:** Future bundle expansion phase (beyond AE scope unless marketplace content requires these types).

## Phase N risks

### RISK-DUAL-N01 — `section_definitions` / `block_definitions` dual-truth risk in Phase R-S editor — [MEDIUM]
- **Status:** OPEN · architectural risk for Phase R-S.
- **Introduced:** Phase N (2026-07-10).
- **Evidence:** `ThemeDocumentSchema` embeds `section_definitions` (= bundle's `sections` Liquid source files) and `block_definitions` (= bundle's `blocks` Liquid source files). If the Phase R-S editor mutates these fields when saving a draft, the embedded Liquid source would diverge from the canonical theme package version in the DB. Phase N marks these fields READ-ONLY in code comments (`packages/theme-engine/src/theme-document.ts` lines 285–297) but does not mechanically prevent editor mutation.
- **Why it matters:** A divergent `section_definitions` would mean `fromThemeDocumentV2` produces a bundle with different Liquid source than what the theme package was published with — silently different rendering behaviour for the same theme version.
- **Mechanical backstop:** `fromThemeDocumentV2` calls `parseLiquidThemePackageBundle(raw)` as its last step. If `section_definitions` has been mutated so that template section types no longer match, the `superRefine` on the bundle will reject the document before it reaches persistence.
- **Disposition:** Phase R-S editor save adapter MUST reconstruct `section_definitions`, `block_definitions`, and `layout` from the original load-time bundle (not from editor state). This must be enforced mechanically in the Phase R-S implementation and documented in the editor architecture. Do NOT add a mutation path for these fields.
- **Target:** Phase R (Visual editor shell).

### RISK-ARCH-N01 — Forward-compat gap: `.strict()` + version gate requires version bump for future schema additions — [LOW]
- **Status:** OPEN · ongoing process requirement.
- **Introduced:** Phase N (2026-07-10).
- **Evidence:** `ThemeDocumentSchema` uses `.strict()`. Any future phase that adds new top-level fields to `ThemeDocumentSchema` without bumping `THEME_DOCUMENT_VERSION` and adding it to `KNOWN_THEME_DOCUMENT_VERSIONS` will silently strip those new fields when Phase N code reads a Phase-AA-written document from the DB. The Zod `.strict()` mode strips unknown fields on parse without error.
- **Why it matters:** A Phase-AA document written by a newer editor could have fields silently dropped when read by any code that has not been updated to the new version. The stripped document would then pass all schema checks and appear valid, masking the data loss.
- **Disposition:** Every phase that adds fields to `ThemeDocumentSchema` MUST: (1) bump `THEME_DOCUMENT_VERSION` to a new string, (2) add the new version to `KNOWN_THEME_DOCUMENT_VERSIONS`, (3) write a `migrateToThemeDocumentV2`-style upgrade function for old-version docs. This is a process rule, not a code enforcement. Phase AA (Custom CSS + code workspace) is the most likely next adder.
- **Target:** Phase AA (Custom CSS + code workspace) and any phase that modifies `ThemeDocumentSchema`.

### RISK-PERF-N01 — Large document size: ThemeDocument may exceed 8MB for complex themes — [LOW]
- **Status:** OPEN · deferred to Phase R-S.
- **Introduced:** Phase N (2026-07-10).
- **Evidence:** `ThemeLiquidSectionFileSchema` allows source up to 200kB per section file (enforced in `theme-bundle.ts`). Urban Kicks has ~40+ section definition files. A full `ThemeDocument` for a complex theme can approach 8MB of JSONB. Deserializing 8MB on every editor load is a performance concern; Supabase JSONB has no hard column-size limit but large payloads increase query latency and memory pressure.
- **Why it matters:** Phase R-S editor load and draft save are on the critical path for merchant editing latency. An 8MB document serialization/deserialization cycle on each section drag or setting change would cause visible lag.
- **Mitigation candidates:** (a) Total `section_definitions` source byte bound added to `ThemeDocumentSchema.superRefine` (e.g. sum ≤ 10MB). (b) Phase R-S loads `section_definitions`/`block_definitions` lazily (from the canonical bundle, not embedded in the draft). (c) Draft storage uses a split representation: mutable template/settings in `theme_editor_drafts`, immutable Liquid source in the theme package row.
- **Target:** Phase R (Visual editor shell) — must profile and choose a mitigation before implementing the draft save path.
