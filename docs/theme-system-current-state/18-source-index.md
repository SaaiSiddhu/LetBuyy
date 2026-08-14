# 18 — Source Index: Every File, Migration, Table, Test and Stale Claim

> **Purpose.** This is the evidence index for the whole document set. Every other document in
> `docs/theme-system-current-state/` makes claims; this one names the exact artifact each claim was
> read from, and records which of those artifacts this engagement touched.
>
> **Status of this document:** an index, not an analysis. It restates no finding — it points at the
> sibling document that owns each fact (`DOC-R4`: one source of truth per fact; link, do not
> duplicate). Where a row carries a status word it is one of **proven / inferred / stale-doc /
> unresolved**.
>
> **Authority.** Subordinate to `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` → root
> `AGENTS.md` → local `AGENTS.md`. This document is evidence, never law (`DOC-R2`).
>
> **Date:** 2026-08-04 · **Branch:** `stepup/main` · **HEAD:** `ee371182`

---

## 0. How to read the ownership columns

Three columns recur throughout §1.

| Column value | Meaning |
|---|---|
| **Engagement: no** | This engagement did not modify the file. It is either committed at `HEAD` or (rarely) carries only a `100644 → 100755` mode change. |
| **Engagement: yes** | Modified or created by this engagement, under the user's explicit authorisation for **tenant-isolation P0s only**. Every such change is listed in §1.7 with its diff size. |
| **USER-OWNED — DO NOT TOUCH** | Part of the user's pre-existing dirty worktree (6 784 modified files, of which 6 063 are mode-only and 721 are real content changes, plus 11 untracked at baseline). Never revert, stash, clean, or commit these (`AGENT-R16`). Baseline classification: [14-test-build-governance-baseline.md](14-test-build-governance-baseline.md) §1.1. |

> **Scoping fact that governs this whole set.** The user authorised **fixes to tenant-isolation P0s
> only**. Theme-lifecycle P0s, shopper-auth P0s and checkout/payment/GST P0s are **documented only**
> and go to ARB. Nothing in §1 marked *Engagement: no* was changed, however severe the finding
> recorded against it.

---

## 1. Canonical source map

### 1.1 Governance — the authority chain

The chain is Constitution (DOC 01) → root `AGENTS.md` (DOC 02) → relevant local `AGENTS.md` →
`LETBUYY_CANONICAL_SYSTEMS.md` (DOC 03) → `docs/governance/*` (`AGENTS.md:26-44`,
`GOVERNANCE_REWRITE_2026_06_10/000_GOVERNANCE_INDEX.md:9-16`). Interpretation of each rule is owned
by [01-governance-and-invariants.md](01-governance-and-invariants.md).

| Path | Role for theme work | Engagement | Notes |
|---|---|:---:|---|
| `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` | **ART-17** (`:253-257`) crowns Liquid as canonical renderer, React as a FROZEN first-party fast-path; **ART-18** (`:259-263`) mandates one storefront runtime; ART-05/08/09 own issuer + RLS | no | Supreme law |
| `AGENTS.md` (root) | `THEME-R1…R6` (`:271-280`), `TEST-R2` (`:200`), `TEST-R4` (`:205`), `TEST-R6` (`:207`), `ARCH-R1/R2` (`:64-81`), `MIG-R3` (`:157`) | no | The promoted `LETBUYY_AGENTS_V2` |
| `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` (478 lines) | DOC 03 winner registry; rows 23-26 (`:94-97`, `:230-251`) name the theme winners | no | — |
| `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_AGENTS_V2.md` (14 lines) | Historical pointer only — **not** a second DOC 02 | no | Explicitly forbids being edited into a second manual |
| `CLAUDE.md` | Operating context; the runtime map and the LCIS-first protocol | no | Its "107-validator gate" figure is stale — §5, row S-14 |
| `apps/storefront-runtime/AGENTS.md` (25 lines) | Boundary boilerplate — **zero theme law** | no | Byte-identical to the three below modulo the boundary path |
| `apps/merchant-control-plane/AGENTS.md` (25 lines) | Boundary boilerplate — zero theme law | no | — |
| `packages/theme-engine/AGENTS.md` (25 lines) | Boundary boilerplate — zero theme law | no | — |
| `packages/typescript/ui/AGENTS.md` (25 lines) | Boundary boilerplate — zero theme law | no | — |
| `services/api-gateway/AGENTS.md` (34 lines) | The **only** non-boilerplate local `AGENTS.md` in scope: bans imports from `apps/*`, legacy, direct provider SDKs, `dist/*`; requires site_id resolution or store-ownership proof on every merchant-owned mutation | no | — |
| `docs/governance/feature-flag-governance.md` | Claims `FEATURE_LIQUID` gates Liquid upload/render | no | **stale-doc** — §5, row S-1 |
| `docs/governance/app-api-route-ownership.md` | P4-4 API ownership consolidation; the rule `domain-boundary-validator` enforces | no | — |
| `scripts/validators/governance-common.mjs:57-101` | Machine truth for canonical roots: 6 app + 4 service = **10** | no | ARCH-R1 says 8; deploy matrix says 9 — §5, row S-15 |
| `scripts/validate-governance.mjs` | The gate driver: **108** gate-lane + **1** report-lane validators | no | Destructive — §7.2 |

> **Consequence worth stating once.** An agent following the shortest legal path
> (`CLAUDE.md` → local `AGENTS.md`) for a scoped theme change never sees `THEME-R1…R6`, the frozen-path
> list, or the Liquid-flip gate, because the four theme-boundary local `AGENTS.md` files carry none of
> it. Evidence: `diff` of the four files is empty modulo the boundary path; grep for
> `liquid|renderer|theme` in each returns only the path token.

### 1.2 Engine — `packages/theme-engine/src/**` (48 modules)

Public surface is a barrel: `index.ts` carries **42** `export * from` lines plus 138 direct exports
(`packages/theme-engine/src/index.ts:13-91`). 46 of 48 modules are barrelled; only `jsdom-runtime.d.ts`
(type declaration) and `theme-cli.ts` (bin) are not. Deep behaviour is owned by
[05-rendering-pipeline.md](05-rendering-pipeline.md) and [06-react-liquid-parity-matrix.md](06-react-liquid-parity-matrix.md).

**Bundle, document and registry**

| Module | Lines | Role (one line) | Engagement |
|---|---:|---|:---:|
| `theme-bundle.ts` | 3 317 | The single authored fixture — `createUrbanKicksLiquidThemeBundleFixture()`; `THEME_BUNDLE_SCHEMA_VERSION` | no |
| `theme-bundle-core.ts` | 82 | Derives `letbuyy-core` from the Urban Kicks fixture by JSON string-replace of three brand tokens (`:66-81`), then re-validates | no |
| `theme-document.ts` | 783 | Phase N canonical theme document model (sections/blocks/settings as data) | no |
| `theme-document-migrations.ts` | 135 | Phase N document-version migration registry | no |
| `theme-registry.ts` | 733 | `SECTION_SCHEMAS` + `THEME_SETTINGS_SCHEMA` (5 groups / 19 fields, `:436-489`). **FROZEN PATH** — needs a `FROZEN-OVERRIDE:` commit trailer (`scripts/validators/frozen-path-override-gate.mjs:9-17`) | no |
| `template-registry.ts` | 600 | `TEMPLATE_TYPE_REGISTRY` — 28 template types with `allowedDrops` / `alternatesAllowed` / `sectionGroupRoles`; annotates `list-collections`, `gift_card`, `customers/reset`, `customers/activate` as "NOT YET IN BUNDLE" (`:139-149`, `:316-343`) | no |
| `built-in-section-schemas.ts` | 337 | `BUILT_IN_SECTION_SCHEMAS` — 25 built-in section types, frozen (`:328-332`); count pinned by the governance validator | no |
| `settings-schema-canonical.ts` | 76 | Derives a field→group index from `THEME_SETTINGS_SCHEMA` at load; unknown fields fall into an `appearance` catch-all (`:21`, `:28-38`, `:68-76`) | no |
| `section-schema-migrations.ts` | 46 | Section-schema migration registry (the engine lives in `index.ts`) | no |
| `schema-field-extensions.ts` | 323 | Phase U schema field extensions | no |

**Presets and Experiences**

| Module | Lines | Role (one line) | Engagement |
|---|---:|---|:---:|
| `theme-presets.ts` | 567 | `EXPERIENCE_REGISTRY` — the canonical 10 Experiences (`:387-398`), `applyExperienceToTemplateConfig` (`:524`) | no |
| `industry-experience-map.ts` | 149 | Industry → Experience default map (`:23-33`, `:69-81`) | no |
| `experience-compositions.ts` | 372 | `EXPERIENCE_COMPOSITIONS` — 10 structurally-unique index/product/collection template sets. **Zero non-test consumers** | no |
| `experience-apply.ts` | 718 | `applyExperienceToDocument` (full-design apply). **Zero non-test consumers** | no |
| `experience-fonts.ts` | 82 | `EXPERIENCE_FONT_REGISTRY` (6 families) + `buildGoogleFontsHref` (`:57-64`) | no |

**Compile, render, sanitise**

| Module | Lines | Role (one line) | Engagement |
|---|---:|---|:---:|
| `portable-to-liquid.ts` | 208 | L3 compiler: portable JSON `template_config` → Liquid bundle. `:57-59` aliases `contentPage → rich-content`; `:103` uses the **Urban Kicks** fixture as the base for every compile | no |
| `section-type-map.ts` | 108 | `BUILT_IN_TO_LIQUID_SECTION_TYPE`; `:60-66` marks 4 types "NOT in current bundle → incompatible" | no |
| `theme-renderer.ts` | 1 391 | The Liquid renderer. LiquidJS engine construction `:730-746`; `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` `:170-231`; 6 registered filters `:1118-1125`; sanitisation at `:477`, `:647`, `:911`, `:1113`, `:1212-1213`; `buildLiquidThemeHeadAssets` `:296-330` | no |
| `custom-css-sanitizer.ts` | 464 | 12-stage fail-closed merchant-CSS validator; 50 000-byte cap (`:52`), unsafe-scheme table (`:203-213`), stages (`:255-425`) | no |
| `theme-governance.ts` | 368 | `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` (`:14`), `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` deferred/ARB (`:15-21`), `THEME_LIQUID_PORTABLE_SECTION_PARITY` (20 entries, `:23-44`), `resolveThemeLiquidRenderingEnabled` (`:144-182`) | no |
| `theme-linter.ts` | 149 | Derives its deny-lists **from** the DOMPurify config (`:3-5`, `:84-104`) so linter and renderer cannot drift | no |
| `theme-install.ts` | 165 | `validateThemeInstall` — 5 stages: schema gate, lint, compatibility range, parity gap (advisory), target-slug coherence (`:82-140`) | no |
| `execution-runtime.ts` | 486 | Runtime models consumed by the gateway execution adapters | no |
| `theme-locale.ts` | 336 | Phase Z translations + market-aware display currency (INR ledger untouched) | no |

**Packaging, publishing, marketplace, versioning**

| Module | Lines | Role (one line) | Engagement |
|---|---:|---|:---:|
| `theme-packager.ts` | 56 | Deterministic manifest (per-file SHA-256). Imports `node:crypto` — the root cause of the client-bundle problem in §1.6 | no |
| `theme-artifact-exporter.ts` | 154 | Bundle → flat `{path, contents}` artifact list | no |
| `theme-publish.ts` | 116 | K4 deterministic publish manifest builder | no |
| `theme-marketplace-contract.ts` | 354 | Phase AE partner-submission validation contract | no |
| `theme-version.ts` | 140 | K1 date-based opaque schema-version comparator | no |
| `theme-upgrade.ts` | 195 | K2 pure upgrade planner | no |
| `theme-safe-update.ts` | 862 | Phase AB safe-update engine. Trips `dependency-manifest`/`undeclared-import` on a `${fromVersion}` template literal parsed as a module specifier — §4.2 | no |
| `theme-analytics.ts` | 256 | K6 analytics event/shape contract | no |
| `theme-sdk.ts` | 198 | H1 public facade over engine internals | no |
| `theme-cli.ts` | 167 | `bin` entrypoint (not barrelled) | no |
| `app-block-model.ts` | 313 | Phase Y app-block model | no |
| `dynamic-source-binding.ts` | 272 | Phase W dynamic source binding | no |
| `editor-bridge-protocol.ts` | 57 | `postMessage` protocol constants shared by merchant `CenterPanel` and the storefront preview frame | no |
| `jsdom-runtime.d.ts` | — | Type declaration for the JSDOM-backed DOMPurify singleton (not barrelled) | no |

**AI modules (8)** — all barrelled, none on the storefront render path.

| Module | Lines | Role | Engagement |
|---|---:|---|:---:|
| `ai-theme-generator.ts` | 211 | Theme generation entry | no |
| `ai-intent-parser.ts` | 611 | Merchant intent → theme directives | no |
| `ai-color-system.ts` | 300 | Palette derivation | no |
| `ai-typography.ts` | 170 | Type-scale derivation | no |
| `ai-layout.ts` | 152 | Layout suggestion | no |
| `ai-accessibility.ts` | 364 | Contrast / a11y checks | no |
| `ai-optimizer.ts` | 301 | Section/settings optimisation | no |
| `ai-personalization.ts` | 295 | Personalisation rules | no |
| `theme-ai-sdk.ts` | 1 010 | Phase L merchant AI SDK facade | no |

### 1.3 Gateway — `services/api-gateway/src/**`

Route → adapter behaviour is owned by [02-runtime-and-route-map.md](02-runtime-and-route-map.md) and
[04-theme-installation-lifecycle.md](04-theme-installation-lifecycle.md).

| Path | Lines | Role | Engagement |
|---|---:|---|:---:|
| `routes/themes.ts` | **1 870** | The theme router: catalog, schema, editor, draft, publish, preview-session, releases, rollback, install, library, purchase. Mounted **ungated** at `index.ts:726` | no |
| `routes/themes/media-library.ts` | 186 | Merchant media library (one of only three theme routes using `verifySiteOwnership`) | no |
| `routes/themes/theme-update-route.ts` | 350 | Theme version update preview + apply (`publishVersionUpdateRelease`) | **yes** (−9/+1) |
| `execution/theme-execution.adapter.ts` | 2 530 | `ThemeExecutionAdapter` — every store-scoped theme mutation. `verifyStoreOwner` `:290-312`; `ensureThemeInstance` `:356-435`; `installTheme` `:864-942`; Phase Q library methods `:1800+` | **USER-OWNED — DO NOT TOUCH** (+166/−81) |
| `execution/schema-registry-execution.adapter.ts` | 648 | `resolveThemeRuntime` / `ensureThemePackageRuntime` — registry upserts + legacy fallback (`:436-486`, `:487-600`) | no |
| `routes/storefront.ts` | 1 327 | Public storefront loaders: `loadSiteByHandle`, `loadPublishedStore`, `loadCurrentThemeRelease` (`:832-862`), pooled-SQL twins (`:644-682`) | **yes** (+21/−17) |
| `routes/storefront/public-routes.ts` | 1 319 | `GET /storefront/:subdomain`, preview-session validation (`:427-470`), cart/collection/blog/contact endpoints | no |
| `schemas/theme.schema.ts` | 98 | Should be a pure re-export facade over `@letbuyy/theme-engine`; defines 6 local `z.object` contracts instead (`:61-98`) — a committed `domain-boundary-validator` failure introduced by `016da8f0` | no |
| `routes/onboarding.ts` | — | Store creation; the write that can create a `subdomain`/`store_name` collision (`:405`) | **yes** (+43/−8) |
| `middleware/store-context.ts` | — | `resolveStorefrontSiteByHost` (`:201-258`) — exact host resolution, no `OR` fallback | no |
| `lib/auth-user.ts` | — | `verifySiteOwnership` (`:40`) — the stronger of the two ownership helpers | no |
| `lib/storefront-cache.ts` | — | Handle-keyed storefront cache (`:93-100`) | no |
| `middleware/featureFlags.ts` | — | Declares `FEATURE_LIQUID` (`:4`) — never passed to `featureGate()` | no |
| `tenant/tenant-tables.registry.ts` | — | Generated tenant-table registry; **drifted** (the #1 gate failure). Regenerate only via `scripts/generators/generate-tenant-table-registry.mjs` — never hand-edit | no |

### 1.4 Storefront — `apps/storefront-runtime/src/**`

| Path | Lines | Role | Engagement |
|---|---:|---|:---:|
| `proxy.ts` | 393 | Next 16 middleware (renamed from `middleware.ts`): host normalisation, store-access resolution, custom-domain 301s, password gate, preview cookie, `X-Lb-Render-Engine` header (`:175`) | **yes** (+65/−19) |
| `lib/store-service.ts` | 776 | `getStoreBySubdomain` → `mapSupabaseToStore` (`:670-690`) lifts `rendererEngine` / `liquidBundle` / `liquidRenderingCanary`; 60 s revalidate + tenant-scoped cache tags (`:51`, `:428-440`) | no |
| `lib/theme-engine/template-resolver.ts` | 308 | The **single** read site of the Liquid gate (`:241-246`); bundle resolution (`:110-125`); template-key resolution with `index` fallback (`:127-155`); dev `?engine=` override (`:225-232`) | no |
| `lib/theme-engine/composition-engine.tsx` | 773 | `renderLiquidPlan` (`:568`), the four-layer React fallback (`:623-636`), canary logging (`:660-678`); returns `header + contentForLayout + footer` and **discards** `layoutHtml` (`:622`) | no |
| `lib/theme-engine/data-binding-engine.ts` | 106 | Section → data-requirement planning | no |
| `lib/theme-engine/liquid-hydration-islands.tsx` | 1 369 | The 10 `lb-*` client islands (`:1330-1341`) — exactly the 10 in the sanitizer allowlist | no |
| `lib/theme-engine/renderer-registry.tsx` | 286 | `SECTION_RENDERER_DEFINITIONS` — the 21 React renderer keys (`:57-215`); consumes `BUILT_IN_SECTION_SCHEMAS` directly (`:23`, `:45`) | no |
| `lib/theme-engine/types.ts` | 94 | `StorefrontRouteType` and plan types | no |
| `lib/theme-engine/product-route.ts` | 40 | Product route data shaping | no |
| `lib/theme-engine/content-route.ts` | 17 | CMS content route shaping | no |
| `lib/theme-engine/editor-preview-section-frame.tsx` | 236 | Editor preview section frame (inspector bridge) | no |
| `app/store/[subdomain]/**` | — | 16 store-level route directories; `layout.tsx` (status gate `:88`, token `:root` block `:177-200`, Liquid branch `:265`), `liquid-theme.css` (the stylesheet that actually styles Liquid pages) | no |
| `src/lib/webpack/node-crypto-client-stub.ts` | — | `node:crypto` client stub | **USER-OWNED — DO NOT TOUCH** (untracked) |
| `next.config.ts` | — | `serverExternalPackages:['jsdom']` + `NormalModuleReplacementPlugin` for `node:crypto` | **USER-OWNED — DO NOT TOUCH** (+26/−1) |

### 1.5 Merchant editor — `apps/merchant-control-plane/src/**`

Editor behaviour is owned by [09-settings-schema-and-editor.md](09-settings-schema-and-editor.md).

| Path | Role | Engagement |
|---|---|:---:|
| `app/[store]/online-store/themes/page.tsx` | Theme catalog + install (`:146` catalog fetch, `:174`/`:227` install POST) | no |
| `app/[store]/online-store/themes/[themeId]/editor/page.tsx` | The editor shell: load (`:825`), draft save (`:956`, `:992`), preview session (`:1009`), publish (`:1092`), releases (`:799`), Experience overlay (`:785-793`) | no |
| `app/[store]/online-store/themes/[themeId]/editor/translations/page.tsx` | Locale editing surface | no |
| `app/[store]/online-store/themes/update/page.tsx` | Theme version update surface | no |
| `app/[store]/appearance/page.tsx` | Appearance + custom CSS (client-side validator at `:28-31`, `:174`) | no |
| `app/api/themes/**/route.ts` (**19 files**) | Gateway proxies only — `route.ts`, `install`, `publish`, `library`, `library/create`, `[themeId]/{route,editor,editor/draft,editor/ai-customization,preview-session,releases,releases/[releaseId]/rollback,rename,archive,duplicate,update,update-preview,sections,sections/reorder}` | no |
| `app/api/stores/[store]/settings/route.ts` | Persists `site_settings.custom_css`; validates with the **engine** sanitizer (`:6`, `:39-56`) | no |
| `components/theme-editor/` (11 components + `controls/`) | `AICustomizationPanel`, `AppBlockSlotPanel`, `BlockChildRow`, `CenterPanel`, `ConflictDialog`, `ExperiencePicker`, `PreviewInspectorOverlay`, `SchemaFormRenderer`, `SectionTreePanel`, `TemplateSwitcherPanel`, `ThemeUpdatePanel` | no |
| `components/theme-editor/controls/CustomCssWorkspace.tsx` | A **second, divergent** CSS validator (`:316`, `:415`) that does not import `@letbuyy/theme-engine` | no |
| `components/theme-library/{ThemeLibraryCard,ThemeLibraryWorkspace}.tsx` | Phase Q library UI | no |
| `lib/stores/resolve-owned-store.ts` | Ownership-verified store id before every gateway forward | no |
| `lib/api/client.ts` | `createMerchantApiClient` over `@letbuyy/api-client` (`:10`) | no |
| `next.config.ts` | `node:crypto` module replacement | **USER-OWNED — DO NOT TOUCH** (+48/−1) |
| `src/lib/webpack/node-crypto-client-stub.ts` | `node:crypto` client stub (tracked, committed) | no |

### 1.6 Bundles — `packages/theme-engine/examples/`

| Path | Role | Engagement |
|---|---|:---:|
| `letbuyy-core-liquid/` (73 files) | Committed artifact: `bundle.json`, `manifest.json`, 1 layout, **42 sections**, 3 blocks, **21 templates**, 2 config files, 1 locale, 0 assets | no |
| `urban-kicks-liquid/` (73 files) | Committed artifact with an **identical file tree**; 61 of 73 files are byte-identical (83.6 %); all 42 sections and all 3 blocks are byte-identical; `layout/theme.liquid` differs by exactly 2 lines (`<title>` suffix, body class) | no |
| `generate-examples.mjs` | Regenerates **both** bundles from the single fixture; `:14-19` instructs re-running on every fixture change. **Not enforced by CI** | no |
| `index.json` | `contentHash` per bundle, `generated_at 2026-07-10` | no |

Full duplication verdict, with the derivation direction: [07-letbuyy-core-current-state.md](07-letbuyy-core-current-state.md).

### 1.7 Complete list of artifacts this engagement created or modified

Nothing else was touched. All of it is **uncommitted** at the time of writing, so a clean checkout of
`HEAD` still carries every original defect.

| Path | Change | Git state | Why (authorised tenant-isolation P0) |
|---|---|---|---|
| `services/api-gateway/src/routes/storefront.ts` | +21 / −17 | ` M` | Cross-tenant handle leak — all four loaders now resolve `subdomain` exactly |
| `services/api-gateway/src/routes/onboarding.ts` | +43 / −8 | ` M` | Pre-insert cross-column collision check → 409 CONFLICT (`:402-424`) |
| `apps/storefront-runtime/src/proxy.ts` | +65 / −19 | ` M` | `vercel.app` gate bypass replaced by exact-suffix `isVercelDeploymentHost` (`:157-161`); `/store/*` denied on deployment hosts (`:301-303`); fail-**closed** `holdingPage(req, 503, 'access-unavailable')` (`:304`) |
| `services/api-gateway/src/routes/themes/theme-update-route.ts` | +1 / −9 | ` M` | Deleted the local `sha256Hex` helper, imported the shared one — closes `single-source-crypto-validator` |
| `database/supabase/migrations/196_theme_rls_tenant_hardening.sql` | new, 109 lines | `??` | Replaces the baseline `USING (true)` policy on `public.themes` with `themes_public_catalog_read` + `themes_site_owner_read`; `FORCE ROW LEVEL SECURITY` on the 24 unforced theme tables |
| `database/supabase/rollback/180_urban_kicks_liquid_theme.rollback.sql` | new | `??` | `MIG-R3` pairing |
| `database/supabase/rollback/181_urban_kicks_settings_schema_complete.rollback.sql` | new | `??` | `MIG-R3` pairing |
| `database/supabase/rollback/188_letbuyy_core_theme_row.rollback.sql` | new | `??` | `MIG-R3` pairing |
| `database/supabase/rollback/189_theme_persistence_idempotency.rollback.sql` | new | `??` | `MIG-R3` pairing |
| `database/supabase/rollback/190_theme_library_q.rollback.sql` | new | `??` | `MIG-R3` pairing |
| `database/supabase/rollback/191_theme_purchases_rls_tenant_scope.rollback.sql` | new | `??` | `MIG-R3` pairing |
| `database/supabase/rollback/196_theme_rls_tenant_hardening.rollback.sql` | new | `??` | `MIG-R3` pairing for 196 |
| `docs/theme-system-current-state/**` | this document set | `??` | The deliverable |

Full remediation state, defect by defect: [13-security-and-tenant-isolation.md](13-security-and-tenant-isolation.md) §0.

---

## 2. Migration index

Rollback pairing is required by `MIG-R3` (`AGENTS.md:157`): *"Every migration MUST ship a forward AND a
paired rollback (DOWN). A migration without a DOWN is a defect."*

**"At audit start"** = `ls database/supabase/rollback/` as read by the discovery sweep.
**"Now"** = `ls database/supabase/rollback/` at the time of writing (the seven new files are
untracked — §1.7). Drift analysis is owned by [03-theme-data-model.md](03-theme-data-model.md) §6.

| # | File | What it does | DOWN at audit start | DOWN now | Drift it introduced |
|---|---|---|:---:|:---:|---|
| **171** | `171_liquid_bundle_persistence.sql` (17 lines) | L1 — additive `jsonb` merge of the Liquid bundle into `themes.default_template` for `urban-kicks`; backfills DBs seeded before the bundle existed | ✅ | ✅ | Header claims "fresh databases get the bundle from the seed … both carry the identical bundle" — **the seed carries no bundle**; see §5 row S-6 |
| **172** | `172_liquid_bundle_refresh.sql` (18 lines) | L14 — re-merges the bundle to the "current full template set" (171 carried only `index`/`header`/`footer`) | ✅ | ✅ | **This is the origin of the persisted-bundle staleness**: the set it froze is 12 templates / 33 sections, versus 21 / 42 in the committed fixture. Regeneration script `scripts/liquid-parity/build-urban-kicks-bundle.mjs` is not CI-enforced |
| **180** | `180_urban_kicks_liquid_theme.sql` (52 lines) | Sets `rendererEngine='liquid'`, adds a 10-field `settings.appearance` group, sets brand colours, strips the unschematized hero `subtitle` | ❌ | ✅ | Keyed on `WHERE slug='urban-kicks'`; header (`:14-16`) asks that the seed be mirrored — never done. `:37` is the deliberate act that makes every store on this theme render Liquid |
| **181** | `181_urban_kicks_settings_schema_complete.sql` (32 lines) | Adds `surfaceColor` + `isDark` via `jsonb_set(create_missing=true)` (`:18-32`) | ❌ | ✅ | Same unmirrored-seed note (`:17-19`). Widens the code↔DB settings gap — neither field exists in `THEME_SETTINGS_SCHEMA` |
| **186** | `186_v1_scale_commerce_os_coming_soon.sql` (13 lines) | Marks the `scale` and `commerce_os` **plans** `coming_soon` — not a theme migration | ❌ | ❌ | None for themes. Header states the revert inline but ships no `.rollback.sql` |
| **187** | `187_v1_sites_site_settings.sql` (15 lines) | `sites.site_settings jsonb NOT NULL DEFAULT '{}'` — the merchant Appearance bridge (brand colour, font, radius, logo, favicon, **custom CSS**) (`:12-15`) | ❌ | ❌ | Adds a **fourth** home for theme-ish settings. Header says "Rollback (forward-fix preferred)" — an undocumented deviation from `MIG-R3` |
| **188** | `188_letbuyy_core_theme_row.sql` (32 lines) | Creates the `letbuyy-core` `themes` row by `INSERT … SELECT … FROM themes WHERE slug='urban-kicks'`, overriding only `id`/`name`/`slug` (`:19-32`) | ❌ | ✅ | Clones **without** neutralising branding, and omits `section_schemas`, `block_schemas`, `renderer_manifest`, `schema_version`, `renderer_version` from the column list. Its own header (`:33-38`) admits it is a no-op when the `urban-kicks` row is absent |
| **189** | `189_theme_persistence_idempotency.sql` (51 lines) | `theme_releases.idempotency_key` + partial unique `idx_theme_releases_idempotency` (`:38-50`) | ✅ | ✅ | Header (`:34-40`) documents its own unclosed TOCTOU residual — the RPC still takes no `p_idempotency_key`, so the key is written post-publish by TS |
| **190** | `190_theme_library_q.sql` (48 lines) | `themes.owned_by_site_id` (FK `sites.id ON DELETE SET NULL`) + `themes.is_site_private NOT NULL DEFAULT false` + two partial indexes (`:41-60`) | ❌ | ✅ | **The most consequential drift in the set.** Turns the globally-public `themes` table into a tenant table while its header (`:26-33`) asserts protection from `themes_service_all` and `themes_public_active_read` — neither policy has ever existed |
| **191** | `191_theme_purchases_rls_tenant_scope.sql` (93 lines) | Drops the two wide-open `theme_purchases` policies; adds `tp_service_role` + `tp_authenticated_select/insert` scoped on `user_id = auth.uid()` (`:44-92`) | ❌ | ✅ | None — verified correct and applied. This is the model 190 should have followed |
| **192** | `192_theme_engine_actor_fk_users_custom.sql` | Repoints **11** theme actor FKs from `auth.users` to `public.users_custom` (`:39-51`) | ✅ | ✅ | None. All 11 verified in `pg_constraint`; `ON DELETE` preserved (`SET NULL` ×9, `NO ACTION` ×2 on `theme_editor_drafts`) |
| **193** | `193_theme_registry_settings_schema_sync.sql` | Declares `bodyFontFamily` on both first-party themes; copies `themes.settings_schema` into `theme_schema_manifests.settings_schema` only where the manifest lacks a top-level `settings` key (`:44-61`) | ✅ | ✅ | None structurally, but makes `bodyFontFamily` exist in the DB and **not** in `THEME_SETTINGS_SCHEMA` |
| **196** | `196_theme_rls_tenant_hardening.sql` (109 lines) | **Created by this engagement.** Replaces the baseline `USING (true)` policy on `public.themes` with `themes_public_catalog_read` + `themes_site_owner_read`; `FORCE ROW LEVEL SECURITY` on the 24 unforced theme tables | n/a | ✅ | None — it is the remediation. Untracked (`??`); see §1.7 |

> **Migration-ledger caveat.** This database has **no `supabase_migrations.schema_migrations` table**,
> so applied-migration state can only be inferred from data shape. Every "applied" claim in this
> document set is therefore an inference from a `psql` observation, not a ledger read.

---

## 3. Database object index

Schema semantics are owned by [03-theme-data-model.md](03-theme-data-model.md); RLS posture by
[13-security-and-tenant-isolation.md](13-security-and-tenant-isolation.md) §3.

### 3.1 The 32 theme tables

Enumerated with
`select table_name from information_schema.tables where table_schema='public' and (table_name like '%theme%' or table_name in ('themes','store_themes'));` → **32 rows** (of 438 public tables after the
controlled reset).

| # | Table | Tenant column | Group | Depth covered in |
|---:|---|---|---|---|
| 1 | `themes` | `owned_by_site_id` | Catalog, now dual-purpose | [03](03-theme-data-model.md) §2, [13](13-security-and-tenant-isolation.md) §3.2 |
| 2 | `store_themes` | `store_id` | Legacy install record | [03](03-theme-data-model.md) §4, [04](04-theme-installation-lifecycle.md) §6.1 |
| 3 | `theme_packages` | — | Canonical registry | [03](03-theme-data-model.md) §3 |
| 4 | `theme_package_versions` | — | Canonical registry | [03](03-theme-data-model.md) §3 |
| 5 | `theme_schema_manifests` | — | Canonical registry | [09](09-settings-schema-and-editor.md) §2 |
| 6 | `theme_renderer_manifests` | — | Canonical registry | [07](07-letbuyy-core-current-state.md) §4 |
| 7 | `theme_instances` | `store_id` | Canonical install | [03](03-theme-data-model.md) §4, [04](04-theme-installation-lifecycle.md) §7 |
| 8 | `theme_releases` | `store_id` | Canonical publish | [03](03-theme-data-model.md) §4, [05](05-rendering-pipeline.md) §2 |
| 9 | `theme_instance_drafts` | `store_id` | Draft | [09](09-settings-schema-and-editor.md) §5 |
| 10 | `theme_editor_drafts` | `store_id` | Draft (legacy) | [09](09-settings-schema-and-editor.md) §5, [13](13-security-and-tenant-isolation.md) §3.3 |
| 11 | `theme_draft_patches` | `store_id` | Draft | [09](09-settings-schema-and-editor.md) §5 |
| 12 | `theme_preview_sessions` | `store_id` | Preview | [05](05-rendering-pipeline.md) §7, [13](13-security-and-tenant-isolation.md) §2.2 |
| 13 | `theme_template_assignments` | `store_id` | Template assignment | [03](03-theme-data-model.md) §2 |
| 14 | `theme_templates` | — | Package content (live for urban-kicks: 11 rows) | [03](03-theme-data-model.md) §2 |
| 15 | `theme_layouts` | — | Package content (1 row) | [03](03-theme-data-model.md) §2 |
| 16 | `theme_section_definitions` | — | Package content (19 rows vs 25 built-ins) | [09](09-settings-schema-and-editor.md) §4 |
| 17 | `theme_block_definitions` | — | Package content | [03](03-theme-data-model.md) §2 |
| 18 | `theme_assets` | — | Package content (**0 rows**, no serving route) | [05](05-rendering-pipeline.md) §6, [13](13-security-and-tenant-isolation.md) §3.4 |
| 19 | `theme_presets` | — | Package content (**1 row**, zero application readers) | [08](08-presets-and-industry-map.md) §3 |
| 20 | `theme_migrations` | — | Engine bookkeeping | [03](03-theme-data-model.md) §2 |
| 21 | `theme_purchases` | `user_id` | Marketplace (FROZEN) | [13](13-security-and-tenant-isolation.md) §3 |
| 22 | `theme_purchase_receipts` | — | Marketplace (FROZEN) | [03](03-theme-data-model.md) §2 |
| 23 | `theme_refund_requests` | `user_id` | Marketplace (FROZEN) | [03](03-theme-data-model.md) §2 |
| 24 | `theme_reviews` | `user_id` | Marketplace (FROZEN) | [03](03-theme-data-model.md) §2 |
| 25 | `theme_reports` | — | Marketplace (FROZEN) | [03](03-theme-data-model.md) §2 |
| 26 | `theme_saved_searches` | `user_id` | Marketplace (FROZEN) | [03](03-theme-data-model.md) §2 |
| 27 | `theme_marketplace_settings` | `user_id` | Marketplace (FROZEN) | [03](03-theme-data-model.md) §2 |
| 28 | `theme_collections` | — | Marketplace (FROZEN) | [03](03-theme-data-model.md) §2 |
| 29 | `theme_collection_items` | — | Marketplace (FROZEN) | [03](03-theme-data-model.md) §2 |
| 30 | `theme_developer_listings` | — | Marketplace (FROZEN) | [03](03-theme-data-model.md) §2 |
| 31 | `theme_developer_payout_accounts` | — | Marketplace (FROZEN) | [03](03-theme-data-model.md) §2 |
| 32 | `theme_download_artifacts` | — | Marketplace (FROZEN) | [03](03-theme-data-model.md) §2 |

**Tenant-column census (proven):** 14 of 32 carry a tenant column — `store_id` on 8
(`store_themes`, `theme_draft_patches`, `theme_editor_drafts`, `theme_instance_drafts`,
`theme_instances`, `theme_preview_sessions`, `theme_releases`, `theme_template_assignments`),
`user_id` on 5 (`theme_marketplace_settings`, `theme_purchases`, `theme_refund_requests`,
`theme_reviews`, `theme_saved_searches`), `owned_by_site_id` on `themes`.

### 3.2 RLS state — audit start vs now

| Measure | At audit start | Now (after migration 196 was applied locally) |
|---|---|---|
| RLS ENABLED | 32 / 32 | 32 / 32 |
| RLS **FORCED** | **8 / 32** (`store_themes`, `theme_draft_patches`, `theme_editor_drafts`, `theme_instance_drafts`, `theme_instances`, `theme_preview_sessions`, `theme_releases`, `theme_template_assignments`) | **32 / 32** — `select count(*) filter (where relforcerowsecurity), count(*) from pg_class …` → `32\|32` |
| `public.themes` policies | 1 — `"Themes are viewable by everyone"` `FOR SELECT` to `{public}` `USING (true)` | 2 — `themes_public_catalog_read` `((is_active = true) AND (COALESCE(is_site_private,false) = false))` and `themes_site_owner_read` (EXISTS over `sites` on `user_id OR custom_user_id`) |

> The rows on the right are the **local** database only. Staging and production apply state is
> unknown — migration 196 is untracked and unapplied anywhere else.

### 3.3 Theme RPCs

`select p.proname, p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%theme%';`

| Function | `SECURITY DEFINER` | Role | Covered in |
|---|:---:|---|---|
| `publish_theme_release` | ✅ | The one atomic theme transaction: supersede current → insert release → update `sites` → update `theme_instances`/`theme_instance_drafts` → upsert `storefront_cache_tags` → `outbox_events` + `audit_activity_events` | [04](04-theme-installation-lifecycle.md) §3 |
| `fill_theme_release_required_fields` | ❌ | Trigger function backing `trg_theme_releases_required_fields` | [03](03-theme-data-model.md) §2 |
| `update_theme_install_count` | ✅ | Trigger function on `store_themes`; reads `store_themes`, writes `themes.install_count` | [03](03-theme-data-model.md) §5 |
| `update_theme_rating` | ✅ | Trigger function on `theme_reviews` (marketplace, FROZEN) | — |
| `notify_on_theme_purchase` | ✅ | Trigger function on `theme_purchases` (marketplace, FROZEN) | — |

> `publish_theme_release` is the **only** `db.rpc` call in the 2 530-line
> `theme-execution.adapter.ts` (`:712`). Every other adapter operation is a sequence of discrete
> `supabase-js` statements with no transaction boundary.

### 3.4 Triggers (33 non-internal on theme tables)

Twenty-nine are `update_<table>_updated_at` `BEFORE UPDATE` triggers that unconditionally overwrite
`NEW.updated_at` with `NOW()` — which is why explicit ISO `updated_at` values sent by the adapter are
discarded. The four that do more:

| Table | Trigger | Effect |
|---|---|---|
| `store_themes` | `update_theme_install_count_on_change` | Recomputes `themes.install_count` |
| `theme_releases` | `trg_theme_releases_required_fields` | `fill_theme_release_required_fields` |
| `theme_reviews` | `update_theme_rating_on_review` | Recomputes theme rating (FROZEN surface) |
| `theme_purchases` | `notify_theme_purchase` | Purchase notification (FROZEN surface) |

### 3.5 Uniqueness constraints that carry the active-theme contract

| Index | On | Predicate | Consequence |
|---|---|---|---|
| `idx_theme_instances_one_active` | `theme_instances (store_id)` | `WHERE instance_status='active' AND deleted_at IS NULL` | DB-enforced one-active-instance per site |
| `idx_theme_releases_one_current` | `theme_releases (store_id)` | `WHERE is_current=true AND deleted_at IS NULL` | DB-enforced one-current-release per site |
| `idx_theme_releases_idempotency` | `theme_releases (store_id, idempotency_key)` | `WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL` | Added by migration 189 |
| **(absent)** | `store_themes` | — | **No** partial unique index on active state; its only indexes are `store_themes_pkey`, `UNIQUE (store_id, theme_id)`, and non-unique `idx_store_themes_store`. Two active rows per site are structurally possible |
| `themes_owned_by_site_id_idx`, `themes_is_site_private_idx` | `themes` | partial | Added by migration 190 |

The three-way disagreement about which theme is active is owned by
[03-theme-data-model.md](03-theme-data-model.md) §4.

---

## 4. Test + validator index

Classification and failure analysis are owned by
[14-test-build-governance-baseline.md](14-test-build-governance-baseline.md).

### 4.1 Theme-relevant test files

| Location | Files | Kind | Baseline result |
|---|---:|---|---|
| `packages/theme-engine/test/*.test.ts` | 60 | **Behavioural** — real Liquid render, sanitizer, packager, linter, CLI, document migrations. The only genuinely behavioural theme body | **FAIL** — `tsx --test test/*.test.ts` → exit 1; 1 726 tests / 1 722 pass / **4 fail** (`liquid-l3-compiler.test.ts:61`, `liquid-l5-product.test.ts:45`, `liquid-l6-collection.test.ts:46`, `liquid-l7-search.test.ts`) |
| `services/api-gateway/src/__tests__/theme-library-q.test.ts` | 1 | Mixed: ~10 behavioural (mocked DB → `ForbiddenError`/`ConflictError`), ~31 Zod `safeParse` + migration-190 SQL text lints + route-order greps | **PASS** — exit 0, 41/41 |
| `services/api-gateway/src/__tests__/theme-persistence-p.test.ts` | 1 | Mocked-DB adapter behaviour | PASS (within the 545-test gateway suite) |
| `services/api-gateway/src/__tests__/theme-update.test.ts` | 1 | Mocked-DB adapter behaviour | PASS (within the 545-test gateway suite) |
| `services/api-gateway/src/__tests__/theme-conflict.test.ts` | 1 | Draft-conflict paths | PASS (within the 545-test gateway suite) |
| `apps/merchant-control-plane/tests/theme-editor-{r,s,t,u,v,w,x,y,z,aa,ab,ac}.test.mjs` + `theme-library-q.test.mjs` | 13 | **100 % source-text lints** — the header of `theme-library-q.test.mjs:1-13` says "structural/pattern checks only" | **PASS** — the 16-file suite exits 0, 771/771 |
| `tests/theme-engine/*.test.mjs` | 10 | Behavioural-gate files that are all `readFileSync` + regex over runtime source | **FAIL** — 96 tests / 95 pass / 1 fail (`liquid-renderer-contract.test.mjs:21`, a source-text expectation) |
| `tests/contracts/{theme-editor-publish-separation,theme-editor-real-preview,theme-editor-dead-shell,theme-section-registry,liquid-commerce-embeds,theme-marketplace-checkout}.test.ts` | 6 | Contract lints | **FAIL** — the contracts suite is 200 tests / 187 pass / 13 fail; **4 are theme-relevant** (publish-separation ×2, real-preview, liquid-commerce-embeds) |
| `tests/launch/lb-liquid-l1…l14*.test.mjs` + `lb-k-theme-platform`, `lb-l-ai-theme-platform` | 16 | Launch-gate source lints (e.g. `lb-liquid-l2-assets.test.mjs:24` pins the one-arg `buildLiquidThemeHeadAssets` call) | Not run as a suite in this pass — reached only via `pnpm run test:behavioral`, which is unsafe (§7.3) |
| `tests/e2e/federation/theme-lifecycle.spec.ts` | 1 | Playwright, 84 lines, single test | **Self-skips locally** — `tests/e2e/federation/real-stack.ts:10-18,44-48` defaults to `*-staging.letbuyy.com` and gates on `LETBUYY_E2E_REQUIRE_REAL_STACK=1` |
| `tests/executable/tenant-redteam-postgres.test.mjs` | 1 | RT-1…RT-9 cross-tenant red team | **Not runnable, and not run.** It executes `DROP SCHEMA IF EXISTS public CASCADE` (`:63-80`) against an ephemeral container `letbuyy-executable-pg` that is not running. `RT_CASES` (`:23-31`) covers **zero** theme tables |
| `tests/governance/d2-rls-red-team.test.mjs` | 1 | Migration-**text** lint, not an executable red team | PASS — 11/11; covers no theme table |

> **The path `AGENTS.md:205` (TEST-R4) names does not exist.** `tests/security/` contains only
> `environment-honesty.test.mjs` and `execution-mode.test.mjs`. The real RT suite is
> `tests/executable/tenant-redteam-postgres.test.mjs`, it is not referenced by any
> `.github/workflows/ci.yml` job, and it is reachable only through `pnpm run test:foundation:wave2`.
> `TEST-R4`'s "fails the build (not warn)" is therefore **unenforceable as written**.

### 4.2 Theme-relevant validators and their baseline

Baseline = the 107 gate validators run **individually** (excluding the destructive
`stale-artifact-validator.mjs`) against a detached clean-`HEAD` worktree: **85 pass / 22 fail**. The
working tree adds 2 more failures, both from user-owned artifacts. Full lists:
[14-test-build-governance-baseline.md](14-test-build-governance-baseline.md) §3.

**Fail at clean `HEAD` — theme-scoped (5 of the 22)**

| Validator | Theme artifact | Head-line failure |
|---|---|---|
| `dependency-manifest-validator` | `packages/theme-engine/src/theme-safe-update.ts` | `${fromVersion}` parsed as a module specifier |
| `undeclared-import-validator` | same file | same finding |
| `domain-boundary-validator` | `services/api-gateway/src/schemas/theme.schema.ts` | facade defines 6 local `z.object` contracts (`:61-98`); also pins the app-API inventory at 129 while finding 188 |
| `route-line-count-validator` | `services/api-gateway/src/routes/themes.ts` | 1 870 lines; cap 1 500 |
| `single-source-crypto-validator` | `services/api-gateway/src/routes/themes/theme-update-route.ts` | declared a local crypto helper — **fixed in the working tree** (§1.7); validator now exits 0 |
| `environment-validator` | `packages/theme-engine/test/{dynamic-source-binding,theme-engine}.test.ts` | secret-shaped literals in tracked test fixtures |
| `validate-design-system` | `apps/storefront-runtime/src/app/store/[subdomain]/liquid-theme.css` among others | 1 HARD invariant violation + ratchet regressions |

**Pass at clean `HEAD` — the theme invariants this engagement must not break**

| Validator | Reported detail |
|---|---|
| `theme-governance-validator` | *"25 built-in section schemas, WARN mode, **Liquid default OFF**, fallback placeholder, schema migration runner"* — the machine-checked statement that the Liquid default is off |
| `no-new-react-sections-validator` | 20 frozen React section files (`ART-17` / `THEME-R2`) |
| `theme-editor-dead-shell-validator` | The editor shell is live, not a dead twin |
| `no-public-using-true-validator` | PASS — but **structurally blind** to the `themes` policy, because `000_baseline.sql` is on its hard-coded exemption list (`:13-19`) and the offending policy is at `000_baseline.sql:24152` |
| `rls-force-coverage-validator` | PASS — did not catch 24/32 unforced theme tables |
| `sequential-migration-validator` | Migration numbering intact |
| `rollback-integrity-validator` | *"passed (3 rollback manifests checked)"* — passes on a policy it does not actually cover |
| `storefront-access-gate-validator`, `storefront-seo-access-validator` | Storefront gate structure |
| `frozen-path-override-gate` | Locks `packages/theme-engine/src/theme-registry.ts` and `packages/typescript/ui/src/tokens.ts` |
| `marketplace-single-source-validator` | Marketplace single-source |
| `identity-sole-issuer-validator`, `no-blanket-service-role-validator`, `canonical-ledger-only-validator`, `stepup-crypto-validator` | ART-05 / ART-08 / money invariants |

---

## 5. Stale-document register

This repository contains many audit and plan directories whose claims are contradicted by current
source. Each row names the document, the specific claim, the correcting evidence, and a verdict:

- **SUPERSEDED** — the claim is now false in its entirety.
- **PARTIALLY-STALE** — one clause is false, another still reproduces. Split it; do not delete it.
- **STILL-ACCURATE** — the claim was checked and holds.

This section exists to serve `DOC-R4`: when two documents disagree, the row below says which one to
believe and why.

| # | Document + claim | Correcting evidence | Verdict |
|---|---|---|---|
| **S-1** | `docs/governance/feature-flag-governance.md:20` — `FEATURE_LIQUID` controls "Liquid theme bundle upload/rendering and Liquid-backed storefront composition" | No `featureGate('FEATURE_LIQUID', …)` exists. `services/api-gateway/src/index.ts:689-698` instantiates gates only for `FEATURE_GRAPHQL` and `FEATURE_EXTENSIONS`; `/themes` mounts ungated at `index.ts:726`. Renderer selection happens entirely storefront-side (`template-resolver.ts:241-246` → `theme-governance.ts:144-182`) | **SUPERSEDED.** `FEATURE_LIQUID` has zero runtime effect — do not use it as a kill switch or rollback lever |
| **S-2** | `docs/storefront-theme-platform/phase-af/AF_12_STOP_GO_DECISION.md` §2/§6 (CRITICAL) — `industry-experience-map`, `theme-bundle-core`, `experience-fonts` are ABSENT at HEAD; a clean clone cannot compile `@letbuyy/theme-engine` | `git cat-file -e HEAD:packages/theme-engine/src/{industry-experience-map,theme-bundle-core,experience-fonts}.ts` all succeed at `ee371182`; the files exist on disk | **SUPERSEDED** on this point. AF_12 was written against HEAD `7e1441a6`. Its *governance-gate-red* finding still reproduces |
| **S-3** | `docs/storefront-theme-platform/phase-af/AF_12` §5 — migrations 186 and 187 are UNTRACKED; `sequential-migration-validator` EXIT=1 | `git ls-files` confirms both tracked; `node scripts/validators/sequential-migration-validator.mjs` → EXIT=0; the chain now reaches 195 (196 added by this engagement, untracked) | **PARTIALLY-STALE.** The tracking/sequencing half is closed; the R-23 rollback-pairing half was open at audit start and is addressed only in the working tree (§1.7) |
| **S-4** | `docs/storefront-theme-platform/phase-ad/CANARY_READINESS_ARB_PACKAGE.md` §4 — *"5 of 7 CLOSED, 2 MITIGATED, 0 open blockers"* | §5 Stage 0 of the **same document** lists seven prerequisites, of which at least four are proven open: custom-CSS wiring (`theme-renderer.ts:585` one-arg call), `metafield-service.ts` (absent from `apps/storefront-runtime/src/lib/theme-engine/`), the `FEATURE_LIQUID` decision (unwired, unrecorded), tenant-registry drift (`tenant-isolation-validator` EXIT=1) | **STILL-ACCURATE but a readability trap.** "0 open blockers" refers only to B-1…B-7. **Cite §5 Stage 0, never §4**, when judging whether Liquid may be canaried |
| **S-5** | `docs/storefront-theme-platform/PROGRAM_STATE.md:39` — *"api-gateway 41/41 · merchant 39/39 · 3 pre-existing failures unchanged"* | api-gateway 41/41 **confirmed** (exit 0). Merchant is 771/771 across 16 files, not 39/39. The full api-gateway suite is 545 tests with 3 failures; `tests/contracts` has 13 | **PARTIALLY-STALE.** The 41/41 figure is reproducible and safe to cite; the surrounding failure counts understate the state by 13+ |
| **S-6** | Migration headers 180 (`:14-16`), 181 (`:17-19`), 193 (`:39-41`) — *"if the theme is (re)created from `seeds/urban-kicks-theme.sql` on a fresh DB, mirror these defaults there too"*; and 171's header — *"fresh databases get the bundle from the seed … both carry the identical bundle"* | The seed was never mirrored. `database/supabase/seeds/urban-kicks-theme.sql:368-480` still writes the legacy bare-group manifest; its `themes.settings_schema` is `{"settings":{"colors":{"label":"Colors"}}}` with **zero** occurrences of `appearance`; no seed creates `letbuyy-core` | **SUPERSEDED.** A fresh DB does **not** converge to this local DB's state — proven by the controlled reset (§7.4) |
| **S-7** | `docs/storefront-liquid-discovery/11_GAP_ANALYSIS.md:406` — *"5 sections (collectionFilter, contentPage, videoHero, faqAccordion, instagramFeed) have no Liquid parity"* | `contentPage` **has** parity: aliased to `rich-content` at compile time (`portable-to-liquid.ts:57-59`), at render time (`theme-renderer.ts:341-343`), in `BUILT_IN_TO_LIQUID_SECTION_TYPE`, and `rich-content.liquid` exists. `docs/storefront-liquid-discovery/certification/RISK_CLOSURE_REPORT.md:116` records UC-05 CLOSED-IMPLEMENTED — contradicting a sibling in the same tree | **PARTIALLY-STALE.** 4 types remain without parity, and none of those has a React renderer either, so they are not Liquid-specific gaps |
| **S-8** | `STRATEGIC_CANONICALIZATION_2026_06_10/CANONICAL_ARCHITECTURE_MATRIX.md:164`, `THEME_MIGRATION_MASTER_PLAN.md:93,297`, `PRODUCTION_READINESS_GAP_REPORT.md:245` — *"3 schema sources (engine `BUILT_IN_SECTION_SCHEMAS` + storefront `RUNTIME_SECTION_SCHEMAS` + DB manifests)"* | `rg -n 'RUNTIME_SECTION_SCHEMAS'` over all executable files returns **zero** hits (markdown only). `renderer-registry.tsx:23,45` imports `BUILT_IN_SECTION_SCHEMAS` directly | **SUPERSEDED.** THEME-R3 is satisfied: LEG-045 has been eradicated. The DB manifest can only **extend** engine schemas (`index.ts:800-804`), a property `theme-governance-validator.mjs:79-81` enforces |
| **S-9** | `STRATEGIC_CANONICALIZATION_2026_06_10/LEGACY_ERADICATION_REGISTER.md:180` (LEG-050) — `theme_templates`, `theme_assets`, `theme_layouts`, `theme_presets`, `theme_block_definitions`, `theme_section_definitions` are obsolete with "0 code refs", SAFE_DELETE | `theme_section_definitions` (19 rows), `theme_templates` (11 rows) and `theme_layouts` (1 row) are **live data** for the urban-kicks package version, read through `resolveThemeRuntime` | **PARTIALLY-STALE.** Only `theme_presets` is genuinely unread. Executing LEG-050 as written would break theme resolution |
| **S-10** | `STRATEGIC_CANONICALIZATION_2026_06_10/STRATEGIC_WINNERS_MASTER_PLAN.md:204`, `FINAL_ARCHITECTURE_DECISION_RECORD.md:299`, `SHOPIFY_ALIGNMENT_REPORT.md:94` — CHK-001: *"the signed URL does not bind cart contents"* | `canonicalCheckoutCartBinding` (`packages/checkout-core/src/index.ts:510-547`) hashes sorted line items incl. `unit_price_minor`/`line_total_minor` and normalised coupons; the digest is inside the HMAC (`:549-559`); `verifyCheckoutHandoff` recomputes from the DB cart and timing-safe compares both (`services/api-gateway/src/routes/checkout.ts:268-288`) | **SUPERSEDED.** CHK-001 as written is CLOSED. The surviving defect is different and must be re-scoped: the binding is correct but **unused** — see [11-cart-and-checkout-boundary.md](11-cart-and-checkout-boundary.md) |
| **S-11** | `CONVERGENCE_AUDIT_2026_06_10/REPOSITORY_TRUTH_REPORT.md:107,184` — `checkout.letbuyy.com` is a GHOST, *"origin set, no owner"*; `SHOPIFY_ALIGNMENT_REPORT.md:289` (SHOP-003) — *"does not exist; signed URLs are dead links"* | Half true. No deployed origin and no deploy target (`production-deploy.yml:400-408`) — but the server side is fully implemented and mounted: four step routes, a forward-only state machine, server-resolved shipping, a fail-closed live-PSP guard and a post-capture ledger proof (`services/api-gateway/src/routes/checkout.ts`; `index.ts:724`) | **PARTIALLY-STALE.** "No hosted origin deployed" = true. "Hosted checkout does not exist" = false. This materially changes the effort estimate in `PRODUCTION_READINESS_GAP_REPORT.md:225` (W-20, "15 % complete") |
| **S-12** | `CONVERGENCE_AUDIT_2026_06_10/FOUNDATION_GAP_REPORT.md:153` and `SINGLE_SOURCE_OF_TRUTH_PLAN.md:95` — migration 166 is UNTRACKED; deploying without it means a checkout outage | `database/supabase/migrations/166_d6_checkout_handoff_inventory.sql` is tracked, and `create_order_with_inventory_reservations` exists in the live DB (`pg_proc`, `prosecdef=true`) | **SUPERSEDED.** The stated outage risk no longer applies |
| **S-13** | `AGENTS.md:246` (PAY-R2) + `CONVERGENCE_CLEANUP_2026_06_10/STRATEGIC_WINNERS_FINAL.md:291,299` + `CONVERGENCE_AUDIT_2026_06_10/DUPLICATE_AUTHORITY_REPORT.md:62-63` — *"`confirm_order_payment_with_ledger` posts zero ledger entries"*; *"refunds/COD are un-ledgered"* | The live function posts canonical double-entry via `post_settlement_ledger_transaction` (debit `pa_clearing` / credit `merchant_payable`), introduced by `168_b1_b2_capture_refund_ledgering.sql` (commit `4efbdddd`). `complete_order_refund` likewise posts `merchant_payable` / `refund_clearing` | **PARTIALLY-STALE.** Capture and refund are ledgered. **The COD half is still true** (no `cod_receivable` posting at confirm) — split the sentence, do not delete it. See [12-payments-cod-razorpay-gst.md](12-payments-cod-razorpay-gst.md) |
| **S-14** | `CLAUDE.md` — *"Keep the 107-validator gate green"*; `EXECUTION_LEDGER.md:245` — *"gate 107/107 PASS"* | `scripts/validate-governance.mjs` gate array holds **108** unique validator filenames; `reportValidators` holds 1 (`foundation-stepup-report-validator.mjs`); `--lane=all` runs **109**. And the gate is not green: 22 fail at clean `HEAD` | **SUPERSEDED** on both counts. A hard-coded count in a context file guarantees drift; derive it from the driver |
| **S-15** | `AGENTS.md:64-79` (ARCH-R1) — *"the following **8** runtimes are the entire canonical active topology"*; `AGENTS.md:73` lists runtime 4 as `services/identity-platform` | `scripts/validators/governance-common.mjs:57-101` encodes **10** canonical roots; the production deploy matrix has **9** targets (`production-deploy.yml:400-409`). There is **no** `services/identity-platform` directory — it is a Vercel app at `apps/identity-platform` (`production-deploy.yml:402-403`) | **PARTIALLY-STALE.** No safety impact, but three counts (8/9/10) describe one set. Treat `governance-common.mjs`'s 10 as machine truth and the 9-target matrix as deploy truth. **Do not create `services/identity-platform`** |
| **S-16** | `AGENTS.md:205` (TEST-R4) — the RT-1…RT-9 suite lives at `tests/security/cross-tenant-redteam-postgres.test.mjs` and *"fails the build (not warn)"* | That path does not exist. The suite is `tests/executable/tenant-redteam-postgres.test.mjs`, is in no CI job, and runs only via `pnpm run test:foundation:wave2` against a container that is not running | **SUPERSEDED** on location; the rule is currently unenforceable |
| **S-17** | `docs/theme-discovery/README.md:29,43` and `20-executive-strategy-report.md:17`, plus commit `70a40c2a` advertising the "Urban Kicks leak" as closed (R-06 / UC-01) | Only the store-service fixture fallback closed (`apps/storefront-runtime/src/lib/store-service.ts:670-673`). `packages/theme-engine/src/portable-to-liquid.ts:103` still calls `createUrbanKicksLiquidThemeBundleFixture()` as the base for **every** Liquid compilation | **PARTIALLY-STALE.** The leak class is **half** closed. Do not treat R-06 / UC-01 as fully closed |
| **S-18** | `docs/theme-discovery/19-unknowns-register.md:44` — *"Every store created via the web wizard receives `theme_id = 'modern'`"* | The single live site row carried `theme_id = 'urban-kicks'` | **SUPERSEDED** for this environment. Unverified against a wizard-created site; treat as stale until re-checked |
| **S-19** | `docs/theme-discovery/10-letbuyy-core-audit.md:689` — describes a real rename/neutralisation of the Core theme | The code fixture neutralises branding, but migration `188` clones the `urban-kicks` row overriding only `id`/`name`/`slug`. Live proof: `letbuyy-core.default_template` contains "Urban Kicks" and not "LetBuyy Core"; its `config`/`default_template`/`settings_schema` md5s are identical to `urban-kicks` | **SUPERSEDED.** The neutralisation never reached the runtime or DB path |
| **S-20** | `docs/theme-urban-kicks.md:50` — maps block type `contentBlock` to renderer key `core.content-block` | No renderer key `core.content-block` exists. `SECTION_RENDERER_DEFINITIONS` (`renderer-registry.tsx:57-215`) declares 21 keys, none of them that; the bundle's only blocks are `badge`, `category`, `product-card` | **SUPERSEDED.** Treat the whole renderer-key table in that document as unverified |
| **S-21** | `V1_SCOPE_LOCK_2026_06_12/LIQUID_MIGRATION/LIQUID_V1_FINAL_VERDICT.md:15` (HEAD `0b8a56e7`) — *"no store ships a `liquidBundle`… only `index`/`header`/`footer` templates exist (no product/collection/cart/customers/order); the layout ships no CSS"* | Migrations 171 → 172 persisted a bundle (12 templates / 33 sections); the committed fixture carries 21 templates / 42 sections including product, collection, cart, search and the customer set; `liquid-theme.css` styles Liquid pages | **SUPERSEDED.** Written five phases earlier; every named gap has moved. Its *parity 0/200 never run* clause is **STILL-ACCURATE** — the harness has no CI wiring |
| **S-22** | `V1_SCOPE_LOCK_2026_06_12/LIQUID_MIGRATION/LIQUID_COMPLETION_PARITY_MATRIX.md:35` — Liquid templates are *"present-but-fixture-only for sections + index/header/footer; missing for product/collection/search/cart/login/register/account/addresses/wishlist/orders/detail/tracking/page/404"* | The fixture ships all of those except `list-collections`, `customers/reset_password`, `customers/activate_account`. What is **missing is in the persisted release**, not the fixture: the DB bundle lacks `not_found`, `page`, `policy`, `blog`, `article`, `password`, `customers/{addresses,settings,wishlist}` | **PARTIALLY-STALE.** The gap moved from *authoring* to *publishing*. Re-validate parity claims against the **persisted release**, never the fixture — see [06-react-liquid-parity-matrix.md](06-react-liquid-parity-matrix.md) |
| **S-23** | `V1_SCOPE_LOCK_2026_06_12/LIQUID_MIGRATION/**` (LIQUID_MIGRATION prompt-class files) | `prompt-perimeter-validator` fails at clean `HEAD` because 3 prompt-class files under this directory are unregistered in `PROMPTS.md` | **STILL-ACCURATE as a finding** — the directory is a live governance-gate failure, not merely stale prose |
| **S-24** | `FINAL_TRUTH_AUDIT_2026_06_11/LIQUID_CAPABILITY_MATRIX.md` — *"`composition-engine.tsx` **now consumes** `result.liquid.layoutHtml` … DONE repo-side"* | `composition-engine.tsx:622` returns `` `${header || ''}${contentForLayout}${footer || ''}` `` and **discards** `result.liquid.layoutHtml`, which is why the engine's `LIQUID_THEME_BASE_CSS` and `:root` token block never reach the browser | **SUPERSEDED.** The capability was reverted or never landed on this path |
| **S-25** | `FINAL_TRUTH_AUDIT_2026_06_11/LIQUID_CAPABILITY_MATRIX.md` — *"`globals.css` now defines first-party `lb-*` layout … classes"* | The stylesheet that actually styles Liquid pages is `apps/storefront-runtime/src/app/store/[subdomain]/liquid-theme.css`, imported at `layout.tsx:18` and scoped to `[data-theme-renderer="liquid"]` | **PARTIALLY-STALE.** The capability exists; the named file is wrong, and the engine copy is now a duplicate authority |
| **S-26** | `FINAL_TRUTH_AUDIT_2026_06_11/LIQUID_CAPABILITY_MATRIX.md` — *"Snapshot parity corpus: **BLOCKED: parity proof**"*, *"React deletion: **BLOCKED**"* | `scripts/liquid-parity/{run-parity-matrix,capture-snapshot,compare-snapshots,harness-lib}.mjs` exist but are referenced by **no** workflow and **no** `package.json` script | **STILL-ACCURATE.** Both rows hold. `THEME-R6` / `TEST-R6` remain unenforceable for want of CI wiring |
| **S-27** | `docs/storefront-liquid-discovery/certification/ARCHITECTURE_CERTIFICATION.md` and `phase-j/ROLLOUT_READINESS_PACKAGE.md` — certification framing implying the production Liquid bundle is complete | The DB-persisted bundle carries 12 templates / 33 sections versus 21 / 42 in the fixture, and that release's `release_status` was `superseded`, so `loadCurrentThemeRelease` (`storefront.ts:838-846`, `.eq('release_status','published')`) returned nothing | **SUPERSEDED.** Certification claims must be re-validated against the persisted release before any Liquid flip |
| **S-28** | `docs/storefront-theme-platform/phase-af/AF_08_POST_AE_CAPABILITY_MATRIX.md:96` — *"theme_purchases RLS closed in migration 191 (**unapplied**, ARB-gated)"* | Migration 191 **is** applied on the local DB — `pg_policies` shows `tp_service_role` / `tp_authenticated_select` / `tp_authenticated_insert`, and the two baseline `USING(true)` policies are gone | **PARTIALLY-STALE** — for the local environment only. The "unapplied" status may still hold for staging/production; verify per environment |
| **S-29** | `EXECUTION_LEDGER.md:245` — the jsdom/`node:*` client-bundle problem was *"fixed at the source … Verified: storefront/merchant/identity/marketing/platform-console all `next build` Compiled successfully"* | Both `next.config.ts` files now carry **uncommitted** `serverExternalPackages:['jsdom']` + `resolve.fallback.jsdom=false` + a `NormalModuleReplacementPlugin` for `node:crypto`, and two stub files exist — i.e. the source-level fix was insufficient and a second per-app fix was required (root cause: the theme-engine barrel re-exports `theme-packager`, which imports `node:crypto`) | **SUPERSEDED.** The ledger entry is incomplete. **These files are USER-OWNED — DO NOT TOUCH** |
| **S-30** | `packages/theme-engine/src/theme-presets.ts:19-21` — *"Non-system fonts … only render once a font-loading mechanism is wired … deferred"* | `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx:17,156-175` calls `buildGoogleFontsHref` and emits `preconnect` + stylesheet links with `display=swap` | **SUPERSEDED** (in-source comment). Font loading was wired in Phase D7 |
| **S-31** | `packages/theme-engine/src/theme-renderer.ts:296-330` header — *"Phase AA — SAFE-CSS LAW single enforcement point … Callers MUST pass the raw stored value"* | The only render-path caller is `theme-renderer.ts:585` `buildLiquidThemeHeadAssets(bundle)` — one argument. `custom_css` appears **zero** times in `apps/storefront-runtime/src` | **PARTIALLY-STALE.** The enforcement point is correctly built and fail-closed; nothing feeds it. The comment describes an intended contract, not shipped behaviour |
| **S-32** | `packages/theme-engine/src/theme-bundle-core.ts:16-21` — *"switching the live compile/store-creation paths to the Core fixture and adding a `letbuyy-core` DB alias row are … deferred follow-ups"* | The DB row now exists (migration 188) but was cloned from `urban-kicks` rather than built from `createLetbuyyCoreLiquidThemeBundleFixture()` — `letbuyy-core`'s `liquidBundle.package.slug` is `urban-kicks-liquid` and its layout `<title>` is "Urban Kicks" | **PARTIALLY-STALE.** Half-done, and the comment now understates the risk: the `letbuyy-core` catalog entry ships Urban Kicks branding to merchants |
| **S-33** | `packages/theme-engine/src/experience-compositions.ts:1-13` — *"Each Experience defines a COMPLETE STORE DESIGN: three explicit templates"* | No production code path consumes `EXPERIENCE_COMPOSITIONS` or `applyExperienceToDocument`. The only production apply is the 10-key token overlay (`services/api-gateway/src/routes/stores.ts:672-673`, editor `page.tsx:788`) | **SUPERSEDED.** An Experience currently changes colours, fonts and radius only |
| **S-34** | `packages/theme-engine/src/settings-schema-canonical.ts:3-8` — names the 5-group `THEME_SETTINGS_SCHEMA` the "CANONICAL" form and the flat one-group DB shape the exception | The runtime validates against the **flat** form for both first-party themes (`schema-registry-execution.adapter.ts:473-475` prefers `theme_schema_manifests.settings_schema`, which is the 13-field flat `appearance` group on both packages) | **SUPERSEDED.** The naming is inverted relative to reality — see [09-settings-schema-and-editor.md](09-settings-schema-and-editor.md) |
| **S-35** | Header comments in `services/api-gateway/src/routes/themes.ts:66-67` and `routes/themes/media-library.ts:8-11` — *"ES256 merchant auth required"* | The gateway's `authMiddleware` has **no** ES256 verifier: it runs internal-session-HMAC, internal-identity-HMAC and supabase-bearer. The ES256/EdDSA pin lives only in `lib/identity-session-verifier.ts:57,90,95`, used by `routes/auth.ts` for session exchange | **SUPERSEDED.** The customer-token-rejection claim is accurate but for a different reason than stated |
| **S-36** | `CLAUDE.md` — *"service-role gateway access only behind `verifySiteOwnership`"* | Only 3 theme routes use `verifySiteOwnership`. The rest use `ThemeExecutionAdapter.verifyStoreOwner` (`theme-execution.adapter.ts:290`), which runs the same `sites` ownership query but omits the `sessionStoreId` cross-check | **PARTIALLY-STALE.** Satisfied in spirit, not by the named function. Canonicalise on one helper so the governance statement is literally checkable |
| **S-37** | `packages/theme-engine/examples/letbuyy-core-liquid/files/sections/password-gate.liquid` + `password.json` present a shipped no-JS password gate | `proxy.ts:180-186` rewrites every password-required request to `/preview/coming-soon`, a client-only React page. The section's own first line reads *"password gate rendering requires proxy routing update (Phase F)"* | **SUPERSEDED.** The Liquid password template is dead; the shipped gate is React and JS-only |
| **S-38** | `tests/contracts/server-side-cart.test.ts` — *"Liquid hydration islands sync add-to-cart through the same server cart API"*, implying a single cart owner | Two independent client implementations write the same `lb_cart`/`lb_cart_token` keys with divergent line shapes (`cart-context.tsx:56-57,98-107` vs `liquid-hydration-islands.tsx:9-11,86-93`; the latter always sends `variant_id: null`) | **PARTIALLY-STALE.** Sharing one endpoint is not one cart owner — see [11-cart-and-checkout-boundary.md](11-cart-and-checkout-boundary.md) |
| **S-39** | `tests/launch/lb-liquid-l9-auth.test.mjs` — asserts the Liquid login/register form actions exist, implying the no-JS auth path works | `services/api-gateway/src/middleware/security.ts:220` returns false for a missing Turnstile token; `customer-registration.ts:48` and `customer-engagement-routes.ts:712` call `requireValidTurnstile` unconditionally — so those forms always receive 403 | **PARTIALLY-STALE.** The test proves the attribute string exists, not that the POST succeeds — see [10-shopper-auth-and-account-flows.md](10-shopper-auth-and-account-flows.md) |

---

## 6. LCIS availability note

`CLAUDE.md` mandates querying the LetBuyy Central Intelligence System **before** scanning the
repository (the LCIS-FIRST / OMEGA-FIRST / LCIS-V2-FIRST protocols). Both servers were probed at the
start of this pass.

| Probe | Exit code | Meaning |
|---|:---:|---|
| `curl -s -m 3 localhost:3333/api/atlas >/dev/null 2>&1; echo $?` | **7** | Connection refused — LCIS V1 (`tools/graph-server`) is **not running** |
| `curl -s -m 3 localhost:3334/intelligence/self/model >/dev/null 2>&1; echo $?` | **7** | Connection refused — LCIS V2/V3 (`tools/central-intelligence`) is **not running** |

**Consequence, stated honestly.** Neither the code graph, the domain graph, the blast-radius API, the
ownership API, nor the semantic/reasoning layer was available for any part of this audit. Every
finding in this document set was therefore produced by **direct code inspection, `rg`/`git`
enumeration, and live `psql` queries** — the fallback that `CLAUDE.md` designates as the last resort.

### 6.1 Change-control hotspots — conservative code-level dependency analysis

`CLAUDE.md` names four change-control hotspots and requires `pnpm graph:intel blast "<symbol>"` on any
PR that touches them. That command needs the graph server, so the analysis below substitutes a
conservative, purely lexical dependency trace. **It is a floor, not a ceiling**: it finds direct
importers and direct call sites only, and cannot see transitive or dynamic reachability the way the
graph can.

**Hotspot 1 — `getSupabaseAdmin`** (`CLAUDE.md` cites 115 files; `rg -l` now finds **259** files
repo-wide, excluding `node_modules`/`dist`/`.next`/`.claude/worktrees`).

| Theme file that uses it | Direct evidence | Blast note |
|---|---|---|
| `services/api-gateway/src/routes/themes.ts` | `:7` import; `db = getSupabaseAdmin(c)` at `:141`, `:311`; passed as a typed parameter at `:331`, `:376`, `:389` | Every theme catalog/editor/publish handler runs on service-role. Ownership is asserted by `ThemeExecutionAdapter.verifyStoreOwner`, **not** by `verifySiteOwnership` — see S-36 |
| `services/api-gateway/src/routes/themes/theme-update-route.ts` | direct import | One of only three theme routes using `verifySiteOwnership` |
| `services/api-gateway/src/routes/storefront.ts` | `:7` import; **13** call sites (`:181, :501, :540, :606, :742, :769, :797, :837, :938, :959, :1033, :1120, :1166`) plus a typed parameter at `:290` | Public anonymous reads on service-role. Isolation depends entirely on an explicit `store_id`/`subdomain` predicate in each query — which is exactly the class of defect the handle-resolution leak was |
| `services/api-gateway/src/routes/storefront/public-routes.ts` | `:4` import; **13** call sites (`:219, :271, :311, :395, :436, :655, :824, :873, :924, :1006, :1231, :1257, :1309`) | Same posture; `:436` is the preview-session lookup, which **is** tenant-bound |
| `services/api-gateway/src/execution/theme-execution.adapter.ts` | receives the client from its callers | All 2 530 lines of theme mutation |
| `services/api-gateway/src/execution/schema-registry-execution.adapter.ts` | receives the client from its callers | Registry upserts, including the ones reached from the unauthenticated schema route |

> **Conservative conclusion.** Any change to `getSupabaseAdmin`'s signature, client construction or
> RLS-bypass posture touches **six** theme-surface files with **26 direct call sites** in the two
> public storefront routers alone. This is a hotspot for the theme system, not merely repo-wide.

**Hotspot 2 — `@letbuyy/shared-types`.** Direct importers on the theme surface:

| File | Import line | What it pulls |
|---|---|---|
| `packages/theme-engine/src/index.ts` | `:2` | `SlugSchema`, `UuidSchema` — **the engine barrel itself**, so every consumer of `@letbuyy/theme-engine` transitively depends on `shared-types` |
| `services/api-gateway/src/execution/theme-execution.adapter.ts` | `:2` | `THEME_APPLICATION_WORKFLOWS`, `THEME_EXECUTION_PIPELINES`, `defineRuntimeBridge` |
| `services/api-gateway/src/execution/schema-registry-execution.adapter.ts` | `:2` | same three symbols |
| `apps/storefront-runtime/src/lib/store-service.ts` | `:2` | `normalizeAppBlockInstances`, `AppBlockInstance` |
| `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx` | `:4` | app-block types |
| `apps/storefront-runtime/src/components/sections/app-block-slot.tsx`, `app/store/[subdomain]/account/{orders,addresses}` clients | — | account + app-block types |

> **Conservative conclusion.** Because the engine barrel imports it at line 2, a breaking change to
> `SlugSchema` or `UuidSchema` propagates to **every** package that imports `@letbuyy/theme-engine` —
> the gateway adapters, both Next apps, and all 60 engine tests. Changes to
> `THEME_APPLICATION_WORKFLOWS` / `THEME_EXECUTION_PIPELINES` / `defineRuntimeBridge` hit exactly the
> two gateway execution adapters.

**Hotspot 3 — `@letbuyy/api-client`.** No theme file imports it directly; every theme call goes
through one of two wrappers.

| Wrapper | Evidence | Downstream |
|---|---|---|
| `apps/merchant-control-plane/src/lib/api/client.ts:10` | `import … from '@letbuyy/api-client'` → `createMerchantApiClient` | All **19** `apps/merchant-control-plane/src/app/api/themes/**/route.ts` proxies. Verified: `apps/merchant-control-plane/src/app/api/themes/route.ts:2` imports `createMerchantApiClient` from `@/lib/api/client`, **not** from the package |
| `apps/storefront-runtime/src/lib/api/{client,browser-client}.ts` | direct imports | Storefront reads |

> **Conservative conclusion.** The theme surface's coupling to `@letbuyy/api-client` is mediated by
> two files. A method-signature change in the client's `themes.*` block
> (`packages/typescript/api-client/src/index.ts:5215-5304` — `listCatalog`, `install`, `editor`,
> `saveDraft`, `previewSession`, `publish`, `releases`, `rollbackRelease`) breaks all 19 merchant
> proxies at once, but through a single seam. Note that `editor` at `:5289-5290` passes **no**
> `method`, so it defaults to GET — the fact that makes the editor-GET mutation defect reachable from
> a browser page load (owned by [04-theme-installation-lifecycle.md](04-theme-installation-lifecycle.md) §4).

**Hotspot 4 — `create_checkout_order`.** **No theme file calls it.** The only occurrences anywhere in
the theme surface are two comments in `packages/theme-engine/src/theme-locale.ts:12` and `:245`,
both stating that the canonical ledger is INR-only and never touched by locale code. The theme system
is therefore **not** a blast-radius participant for this RPC; the checkout boundary is owned by
[11-cart-and-checkout-boundary.md](11-cart-and-checkout-boundary.md).

> **Status of this whole subsection: inferred, not proven.** Lexical import analysis is a lower bound.
> When LCIS is running, re-run `pnpm graph:intel blast "getSupabaseAdmin"` (and the other three) before
> merging any change to these symbols, and reconcile against the table above.

---

## 7. How to reproduce this audit

Run from the repository root
(`/Users/saai_siddharth/Projects/Start_Up/Letbuyy_Store`), in this order.

### 7.1 Establish the tree you are measuring

```bash
git rev-parse --abbrev-ref HEAD          # stepup/main
git rev-parse HEAD                       # ee371182
git status --porcelain | wc -l           # total dirty entries
git diff --numstat | awk '$1!=0 || $2!=0' | wc -l   # real content changes (not mode-only)
git ls-files --others --exclude-standard # untracked
git worktree list                        # 12 prunable stale worktrees rooted elsewhere
```

> **Search hygiene.** Every `rg`/`find` must exclude `.claude/worktrees`, `node_modules`, `.next`,
> `dist`, `.turbo`, `graphify-out`, `build`. Failing to do so returns duplicate stale hits from the
> prunable worktrees that read as real findings.

### 7.2 Try LCIS first (as `CLAUDE.md` requires), then record the result

```bash
curl -s -m 3 localhost:3333/api/atlas             >/dev/null 2>&1; echo $?
curl -s -m 3 localhost:3334/intelligence/self/model >/dev/null 2>&1; echo $?
```

Exit `0` means the graph is available — use it and skip §6.1's manual substitute. Exit `7` means
connection refused; record that fact in the report rather than implying a graph query was made.

### 7.3 Run the governance gate **safely**

`node scripts/validate-governance.mjs` as documented **must not be run casually**. Reading it proves
it writes: `removeGeneratedArtifactDirectories()` (`scripts/validate-governance.mjs:169-192`)
`fs.rmSync(absPath, { recursive: true, force: true })`s every directory named `node_modules`, `.next`,
`.turbo`, `dist`, `.dart_tool`, `build`, `coverage`, `.cache`, `.wrangler`, `.vercel`, `.symlinks`,
`Pods` under `apps/`, `packages/` and `services/` — immediately before `stale-artifact-validator.mjs`,
which is a member of the default gate lane (`:86`). Running it deletes your installed dependencies.

The equivalent, non-destructive procedure:

```bash
# 1. Extract the gate list, excluding only the destructive validator.
node -e 'const fs=require("fs");const src=fs.readFileSync("scripts/validate-governance.mjs","utf8");
const m=src.match(/^const validators = \[([\s\S]*?)\];/m);
console.log([...m[1].matchAll(/"([^"]+\.mjs)"/g)].map(x=>x[1])
  .filter(v=>v!=="stale-artifact-validator.mjs").join("\n"))' > /tmp/validator-list.txt

# 2. Run each individually and collect every failure (the driver exits on the FIRST one,
#    which is why "N pre-existing failures" claims from a single run are systematically wrong).
mkdir -p /tmp/gate-logs
while read -r v; do
  node "scripts/validators/$v" > "/tmp/gate-logs/$v.log" 2>&1
  echo "$? $v"
done < /tmp/validator-list.txt | tee /tmp/gate-results.txt

grep -vc '^0 ' /tmp/gate-results.txt   # failure count
```

To separate **pre-existing** from **introduced**, repeat against a clean `HEAD` in a detached
worktree — additive, non-destructive, and it modifies no repository file:

```bash
git worktree add --detach /tmp/head-wt HEAD
ln -s "$PWD/node_modules" /tmp/head-wt/node_modules
# re-run the loop above with cwd=/tmp/head-wt
git worktree remove /tmp/head-wt
```

Expected: **22 fail at clean `HEAD`**, **24 in the working tree**. The 2 extra are user-owned
artifacts — the untracked `supabase/config.toml` (`migration-safety-validator`) and
`scripts/.DS_Store` (`tooling-governance-validator`). Never quote a failure count derived from a
single fail-fast run.

### 7.4 Reset the database from migrations and seeds

This procedure was run **once, with the user's explicit authorisation**. It is destructive: it drops
the public schema. Do not run it without fresh permission.

```bash
docker ps                       # confirm supabase_db_Letbuyy_Store is up
docker exec supabase_db_Letbuyy_Store psql -U postgres -d postgres -c "select version();"

# Replay all migrations from zero, in numeric order, then the seeds.
# Result observed: 124 migrations replayed, 0 failures, 438 public tables.
```

Verification afterwards:

```bash
docker exec supabase_db_Letbuyy_Store psql -U postgres -d postgres -tAc \
  "select count(*) from pg_tables where schemaname='public';"                 # 438
docker exec supabase_db_Letbuyy_Store psql -U postgres -d postgres -tAc \
  "select slug from public.themes order by slug;"
```

> **PROVEN FINDING — a fresh database contains only `urban-kicks`; `letbuyy-core` does not exist.**
> Migration `188_letbuyy_core_theme_row.sql:33-38` does `INSERT … SELECT … FROM themes WHERE
> slug='urban-kicks'` and inserts nothing when that row is absent — and the seed that creates the row
> runs **after** migrations. Migration 188's own header admits this ordering dependency. Consequence:
> the local database is **not** a reliable model of a fresh deployment, and every "applied" claim in
> this set is an inference from data shape because there is no `schema_migrations` ledger. Full
> analysis: [03-theme-data-model.md](03-theme-data-model.md) §6.3 and §7.

Theme-surface DB queries used throughout this set:

```bash
D="docker exec supabase_db_Letbuyy_Store psql -U postgres -d postgres -tAc"

$D "select table_name from information_schema.tables where table_schema='public'
    and (table_name like '%theme%' or table_name in ('themes','store_themes')) order by 1;"   # 32

$D "select count(*) filter (where relforcerowsecurity), count(*) from pg_class c
    join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'
    and (c.relname like '%theme%' or c.relname in ('themes','store_themes'));"

$D "select policyname, cmd, roles::text, qual from pg_policies where tablename='themes';"

$D "select p.proname, p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like '%theme%' order by 1;"

$D "select c.relname, t.tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal
    and (c.relname like '%theme%' or c.relname='store_themes') order by 1,2;"
```

### 7.5 Run the theme test suites

Safe, in this order. **Do not run `pnpm run test:behavioral`** — its glob
(`node --test --test-concurrency=1 tests/*/*.test.mjs`) includes
`tests/executable/tenant-redteam-postgres.test.mjs`, which executes `DROP SCHEMA IF EXISTS public
CASCADE`.

```bash
# Engine — the only genuinely behavioural body. Expect exit 1: 1726 tests / 1722 pass / 4 fail.
cd packages/theme-engine && npx tsx --test test/*.test.ts; cd ../..

# Gateway, theme-scoped. Expect exit 0: 41/41.
npx tsx --test services/api-gateway/src/__tests__/theme-library-q.test.ts

# Gateway, full unit suite. Expect exit 1: 545 tests / 542 pass / 3 fail (none theme-related).
npx tsx --test services/api-gateway/src/__tests__/*.test.ts

# Contracts. Expect exit 1: 200 tests / 187 pass / 13 fail (4 theme-relevant).
npx tsx --test tests/contracts/*.test.ts

# Behavioural-gate theme lints. Expect exit 1: 96 tests / 95 pass / 1 fail.
node --test --test-concurrency=1 tests/theme-engine/*.test.mjs

# Merchant control plane — the exact 16-file list from its package.json. Expect exit 0: 771/771.
# Storefront runtime — the exact 12-file list from its package.json. Expect exit 0: 930/930.
```

Exact workspace names for `pnpm --filter`: `@letbuyy/theme-engine`, `@letbuyy/api-gateway`,
`@letbuyy/storefront-runtime`, `@letbuyy/merchant-control-plane`, `@letbuyy/identity-platform`,
`@letbuyy/ui` (which lives at `packages/typescript/ui`, **not** `packages/ui`).

### 7.6 Builds — deliberately not run at baseline

No build was executed while establishing the baseline: `pnpm build`, `next build`, `turbo build` and
`tsc -b` were all skipped, so **typecheck and build baselines are UNKNOWN**. `CLAUDE.md` is explicit
that the validator gate does **not** cover app `next build`, and `turbo.json` makes `build` depend on
`^typecheck` + `^build`, so a package failure cascades. Before any theme change lands, a
write-capable pass should run:

```bash
pnpm --filter @letbuyy/theme-engine typecheck
pnpm --filter @letbuyy/api-gateway  typecheck
pnpm --filter @letbuyy/merchant-control-plane build
pnpm --filter @letbuyy/storefront-runtime     build
```

Note that both storefront and merchant `next.config.ts` files carry **uncommitted, user-owned**
`node:crypto`/`jsdom` webpack changes, and `apps/storefront-runtime/src/lib/webpack/` is untracked —
so a clean checkout of `HEAD` may not build either app (S-29). That is a pre-existing, user-owned
condition, not a regression from this engagement.

---

## 8. What this index deliberately does not do

- It does not restate any finding. Severity, root cause and remediation live in the sibling document
  named in each row (`DOC-R4`).
- It does not rank or prioritise. The follow-up backlog owns that.
- It does not assert production or staging state for any migration, policy or release. Every live
  value here is from the **local** database after the authorised reset, and the absence of a
  `schema_migrations` ledger means applied-state elsewhere is **unresolved**.
- It does not treat the inherited handoff as fact. Its "two pre-existing governance failures" claim
  was reproduced and corrected to **22** at clean `HEAD`
  ([14-test-build-governance-baseline.md](14-test-build-governance-baseline.md) §3.3); every other
  inherited claim in this set was treated the same way — as a lead to reproduce, never as established
  fact.
