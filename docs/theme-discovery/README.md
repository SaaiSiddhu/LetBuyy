# LetBuyy Theme Platform — Phase B Discovery

> Phase B deep investigation: adaptive themes, AI store generation, MCP readiness, unknowns, and strategy.

---

## Quick Navigation

| # | Document | Topic | Key Answer |
|---|---|---|---|
| 10 | [Core Theme Audit](10-letbuyy-core-audit.md) | Urban Kicks anatomy and LetBuyy Core generalization path | Urban Kicks branding is in 13 specific fields only; a LetBuyy Core bundle is a contained refactor, not a rewrite. `compilePortableToLiquidBundle()` silently injects Urban Kicks into every Liquid store — this is the highest-priority correctness fix. |
| 11 | [Preset System Discovery](11-preset-system-discovery.md) | Four-layer preset architecture, 8-vertical analysis, pure-JSON feasibility | All vertical presets can be expressed as pure JSON with zero new Liquid source for grocery, electronics, and fashion at 80% completeness. The preset container exists; the activation API does not. |
| 12 | [Config Graph](12-theme-configuration-graph.md) | Full configuration hierarchy from platform to per-block settings | 35-node configuration tree mapped; static vs dynamic vs runtime fields catalogued; 4 missing configuration dimensions identified (per-page overrides, conditional visibility, personalization, A/B variants). |
| 13 | [AI Store Generation](13-ai-store-generation-feasibility.md) | Per-vertical API coverage and gap analysis for automated onboarding | Electronics (75% feasible) and fashion (70%) are ready now. Grocery (65%) is workable. Dairy and restaurant are fundamentally blocked by missing platform domains (subscriptions, menu modifiers). |
| 14 | [LCIS Operations](14-lcis-theme-operations.md) | Complete theme operations inventory classified by API maturity | 23 theme operations catalogued: 11 fully API-driven, 3 partially ready, 4 UI-only, 8 missing entirely. LCIS tier-1/2/3 integration architecture defined. |
| 15 | [MCP Readiness](15-mcp-readiness-analysis.md) | Tool-by-tool readiness for an MCP server wrapping the LetBuyy API | 26 of 31 MCP tool candidates are backed by existing callable gateway APIs today. Top 5 blockers: `apply_preset` endpoint, atomic section PATCH, AI navigation generation, active-theme read, end-to-end store generation. |
| 16 | [Marketplace Model](16-theme-marketplace-future-model.md) | Three marketplace models evaluated against India-first commerce requirements | Model B (preset marketplace, weighted score 8.05/10) outperforms Model A (traditional bundles, 3.85) and Model C (hybrid, 7.55). Recommendation: ship Model B first; evolve to Model C. Marketplace is code-complete but frozen by ARB. |
| 17 | [Editor Future](17-theme-editor-future-architecture.md) | Theme editor gaps, Liquid preview bridge, versioning, AI-assisted editing | Confirmed postMessage type-name bug breaks section selection highlight. Rollback button exists in API but is not wired in UI. Full Liquid preview bridge requires 4 concrete steps, all specified. |
| 18 | [Store Journey](18-store-generation-journey.md) | Current onboarding flow vs AI-native future state, hook points and data model | Web wizard hardcodes `theme_id='modern'` and collects no industry data. Step 1.5 vertical picker + `POST /onboarding/ai-intent` + async queue-worker scaffold = 5-minute AI store for grocery/electronics/fashion. |
| 19 | [Unknowns Register](19-unknowns-register.md) | 32-item risk and uncertainty map across 4 priority tiers | 15 Critical, 6 High, 7 Medium, 5 Low unknowns. 7 architectural decisions that require humans to choose between options before building. 12-item risk register with probability/impact/mitigation. |
| 20 | [Executive Strategy](20-executive-strategy-report.md) | 30-60-90 day roadmap, decision points, critical path, risk register | 6 Tier-1 initiatives (Days 1–30) to resolve foundation blockers. 4 Tier-2 (Days 31–60) for MCP server and AI onboarding. 3 Tier-3 (Days 61–90) for AI-native commerce and ARB submissions. 6 human decisions required before building. |

---

## Executive Summary

LetBuyy's theme platform has a production-hardened Liquid engine — 40 section types, 9 hydration islands, 74% storefront route coverage, and a three-layer security pipeline (Zod ingestion + LiquidJS `outputEscape:'escape'` + DOMPurify JSDOM FORBID lists). The foundation is sound. The critical gap is the missing operational layer that connects the engine to merchant value.

Every Liquid-compiled store currently inherits Urban Kicks branding because `compilePortableToLiquidBundle()` uses `createUrbanKicksLiquidThemeBundleFixture()` as its base for all stores — injecting `- Urban Kicks` in browser tab titles, `lb-theme--urban-kicks` on the body element, and `storeName: 'Urban Kicks'` in header and footer defaults. This is a live correctness defect, not a planning concern. It is the first code change Phase B must make.

The preset infrastructure exists at the schema layer — `ThemeBundleSettingsDataSchema` has a `presets` field — but zero preset definitions are written and no activation path exists anywhere in the system. `themes.ts` (1,493 lines) has no `/preset` route. The `ThemeExecutionAdapter` has no `applyPreset()` method. Yet 26 of 31 MCP tool candidates are already backed by callable gateway APIs, meaning a full "configure storefront via AI" workflow is three targeted additions away: a `ThemePresetDocumentSchema` Zod type, three vertical preset definitions, and `POST /v1/themes/:slug/apply-preset`.

The web onboarding wizard hardcodes `theme_id = 'modern'` and collects no industry or vertical data. The `Step4Schema` with `industry`, `brand_tone`, and `business_goal` fields exists in `packages/tenant-core` and is used by the mobile wizard but is never wired into the web path. Every web-created store is an empty shell. Adding a Step 1.5 vertical picker plus a `POST /onboarding/ai-intent` endpoint plus an async queue-worker scaffold converts the current blank-slate experience into a 5-minute AI-configured store for grocery, electronics, and fashion verticals — without touching the frozen marketplace or requiring ARB approval.

Dairy, restaurant, and food service verticals are blocked by platform domains that do not exist — subscriptions (confirmed NOT IMPLEMENTED in LCIS v11), menu modifiers, and delivery slot ordering. Marketing these verticals without this disclosure will cause merchant churn. The theme engine itself is not the constraint; the missing platform domains are. These are 8–16 week new domain builds, not theme-engine tasks.

The recommended path is a 90-day build sequence: first resolve the three foundation blockers (Core theme identity, preset schema and API, Liquid editor preview bridge and postMessage bug), then ship the first three vertical presets and a 7-tool MCP server, and finally wire AI store generation into onboarding — delivering a fully AI-native commerce platform by Day 90.

---

## Top 10 Discoveries

1. **Every Liquid-compiled store inherits Urban Kicks branding right now.** `compilePortableToLiquidBundle()` in `portable-to-liquid.ts` calls `createUrbanKicksLiquidThemeBundleFixture()` as its base for ALL stores, not just Urban Kicks stores. This injects the `- Urban Kicks` title suffix, `lb-theme--urban-kicks` CSS class, and `storeName: 'Urban Kicks'` header/footer defaults into every merchant storefront on the Liquid path. (Doc 10, Section 3)

2. **Preset infrastructure exists but has no activation path anywhere in the system.** `ThemeBundleSettingsDataSchema` has `presets: Record<string, Record<string, unknown>>` and the Urban Kicks fixture has `presets: {}` (empty). There is no `POST /v1/themes/:slug/apply-preset` route, no `ThemeExecutionAdapter.applyPreset()` method, and no merchant-control-plane action that reads from this field. (Doc 11, Section 7; Doc 15, Section 2)

3. **26 of 31 MCP tool candidates are callable right now with zero new backend work — if authentication is resolved.** The `apply_preset`, `generate_navigation`, and `generate_store_from_description` tools are the only gaps; 26 cover full CRUD for stores, themes, products, collections, pages, and AI content generation. (Doc 15, Section 4)

4. **Full vertical presets for grocery, electronics, and fashion are pure JSON with zero Liquid source changes.** A complete preset is a `settings_data` delta (colors, fonts) plus a `templates` map (section order, settings, blocks). All required section types already exist in the bundle for 80% presets across three priority verticals. (Doc 11, Section 6)

5. **The theme editor has a confirmed postMessage type-name bug that may break section selection for React-rendered sections, not just Liquid.** `CenterPanel` sends `LETBUYY_THEME_EDITOR_SELECTION` (all caps) but `EditorPreviewSectionFrame` listens for `letbuyy:theme-editor:section-selected` (past tense, different casing). These strings do not match. The selection highlight in the preview pane likely never fires. (Doc 17, Section 4)

6. **The web onboarding wizard collects no industry data and hardcodes `theme_id = 'modern'` for every store.** The mobile 6-step wizard collects `industry`, `brand_tone`, and `business_goal` via `Step4Schema` in `packages/tenant-core` but this is never wired into the web path. Every web-created store gets an empty shell with a possibly ghost DB reference. (Doc 18, Section 1 and 4)

7. **Dairy and restaurant verticals are blocked by missing platform domains, not by theme engine gaps.** Dairy requires subscriptions (confirmed NOT IMPLEMENTED in LCIS v11 — no `/v1/subscriptions` route, no subscription tables). Restaurant requires menu modifiers and delivery slot ordering. These are new platform domains requiring 8–16 weeks of engineering, not theme-engine tasks. (Doc 13, dairy/restaurant gap analysis)

8. **Font loading is completely absent from the theme engine.** `headingFontFamily` and `bodyFontFamily` accept font name strings but no `@font-face` or Google Fonts `<link>` is ever emitted. Every preset specifying `Playfair Display` (fashion), `Cormorant Garamond` (jewelry), or `Merriweather` (dairy) silently falls back to `system-ui`, losing 40–50% of the visual differentiation value of presets. (Doc 10, Section 5; Doc 11, Section 7 item 7)

9. **The theme marketplace is fully code-complete but frozen by ARB with 9 operational items blocking launch.** `deploymentAuthority.platform = "frozen-not-deployed"` in `runtime.manifest.json`. Vercel project provisioning, secrets wiring, GSTIN, and Razorpay Route payout are the remaining blockers — no new application code is required for a Model B (preset marketplace) launch. (Doc 16, Section 1 and 6)

10. **The rollback button in the theme editor VersionTree is not wired despite the API being complete.** `POST /themes/:slug/releases/:releaseId/rollback` is implemented, tested, and used by `ThemeExecutionAdapter`. The `VersionTree` component renders the release history but has no `<Button>` calling the API. This is a 1-day UI task that completes a critical merchant safety feature. (Doc 17, Section 2; Doc 14, Section 1 row 12)

---

## Adaptive Theme System Readiness

| Capability | Readiness | Gap |
|---|---|---|
| Core Theme (LetBuyy Core) | NOT READY — blocked | Urban Kicks branding embedded in all Liquid-compiled stores via `compilePortableToLiquidBundle()`. `createLetbuyyCoreLiquidThemeBundleFixture()` does not exist. 13 specific fields require rename/neutralization. 2–3 days to fix. |
| Preset System | SCHEMA ONLY — no activation | `ThemeBundleSettingsDataSchema.presets` field exists; `settings_data.presets` is always `{}`. No `ThemePresetDocumentSchema` Zod type. No `apply-preset` API route. No preset definitions for any vertical. All three layers missing. |
| Industry Verticals | PARTIAL — 3 of 8 achievable as pure JSON | Grocery, electronics, fashion: 80% preset achievable with existing sections. Full presets need `nutrition-table`, `product-specs`, `lookbook`. Dairy/restaurant blocked by missing platform domains (subscriptions, menu modifiers). |
| AI Generation | PARTIAL — 26/31 APIs exist | `POST /v1/ai/homepage` exists but targets JSON-contract sections (not Liquid bundle). `apply_preset` and `generate_store_from_description` missing. AI inference works; preset application and full chaining do not. |
| MCP Tools | NOT BUILT — infrastructure exists | No `@modelcontextprotocol/sdk` in any `package.json`. No MCP server. No API key minting route. All 26 ready-now tools are unblocked at the API level if authentication is resolved. 2–3 days to build the 7-tool MVP server. |
| Editor Support | PARTIAL — React works, Liquid broken | React section selection works (when postMessage bug is fixed). Liquid sections: no `EditorPreviewSectionFrame` wrapper, no click-to-select, no bridge script. Rollback button not wired. Font preview absent. |
| Marketplace Distribution | FROZEN — code complete, ARB required | `apps/theme-marketplace` is code-complete. 9 operational items block launch (Vercel project, secrets, GSTIN, payout). ARB reopen required (`deploymentAuthority.platform = "frozen-not-deployed"`). |

---

## LCIS Theme Intelligence Readiness

**What LCIS can do with themes today:**

LCIS can call three existing gateway endpoints to build a complete read-only theme intelligence picture for any store:
- `GET /v1/themes?store_id=X` — active and installed theme state
- `GET /v1/themes/:slug/editor?store_id=X` — draft, schema, release metadata (note: `ensureThemeInstance` side-effect on first call)
- `GET /v1/themes/:slug/releases?store_id=X` — full release history

From these three calls LCIS can produce: active theme slug and release version, installed theme inventory, draft state and age, schema manifest version, schema drift detection (comparing `schema_manifest_version` in latest release vs current registry), draft staleness alerts, and theme instance health checks. No new backend work is required for read-only intelligence. (Doc 14, Section 6)

**What would enable deeper LCIS theme intelligence:**

| Capability | Missing API | Estimated Effort |
|---|---|---|
| Read a specific past release's full config (rollback analysis) | `GET /themes/:slug/releases/:releaseId` — listReleases returns metadata only | 1 day |
| Get active theme + live config in one call (no editor side-effects) | `GET /themes/store/:storeId/active` | 1 day |
| Cross-theme change timeline for incident investigation | `GET /themes/store/:storeId/timeline` | 1 day |
| Atomic single-section update (no full config replacement) | `PATCH /themes/:slug/editor/sections/:sectionId` | 2–4 hours |
| Bulk section update for AI layout redesign | `POST /themes/:slug/editor/sections/bulk-patch` | 1 day |
| Apply a named preset in one call | `POST /themes/:slug/apply-preset` | 2–3 hours (after preset schema exists) |

LCIS write operations (save draft, publish, rollback) should follow a three-tier model: Tier 1 (read-only intelligence — call autonomously), Tier 2 (draft writes and publish — require user approval with proposed diff shown), Tier 3 (auto-rollback on error spike — surface as recommendation only, never execute without explicit human click). (Doc 14, Section 6)

---

## MCP Readiness Summary

**Top 5 tools READY NOW** (backed by existing gateway APIs, zero new backend work required):

| Tool | API | Value |
|---|---|---|
| `get_theme_schema` | `GET /v1/themes/:slug/schema` | Agent reads available settings/sections/blocks before making changes |
| `get_editor_state` | `GET /v1/themes/:slug/editor?store_id=` | Agent reads current draft + published config + all schemas |
| `save_draft` | `PUT /v1/themes/:slug/editor/draft` | Agent writes modified settings without affecting live storefront |
| `publish_theme` | `POST /v1/themes/:slug/publish` | Agent promotes draft to live after merchant approval |
| `create_preview_session` | `POST /v1/themes/:slug/preview-session` | Agent returns a signed preview URL for merchant review (900s TTL) |

**Top 5 tools BLOCKED** (require new backend work):

| Tool | Gap | Estimated Unblock Effort |
|---|---|---|
| `apply_preset` | No `POST /v1/themes/:slug/apply-preset` route; no preset definitions in Urban Kicks bundle | 2–3 days (after `ThemePresetDocumentSchema` + preset definitions exist) |
| `update_section_settings` (atomic) | No `PATCH /themes/:slug/editor/sections/:sectionId`; must do read-modify-write on full config | 2–4 hours for dedicated endpoint |
| `generate_navigation` | No `POST /v1/ai/navigation` route; AI router handles `generate`, `homepage`, `operator` only | 3–5 days |
| `get_active_theme` | No `GET /themes/store/:storeId/active`; must filter paginated catalog | 1 day |
| `generate_store_from_description` | `POST /v1/ai/operator` produces a tool plan but does not execute it; no workflow-execution route | 3–4 weeks (MCP server handles chaining) |

**What unlocks all 26 ready-now tools:** One human decision — MCP authentication strategy. Choose between (A) OAuth 2.0 Authorization Code Flow with PKCE reusing the existing ES256 JWT system (no new infrastructure, requires browser consent flow) or (B) store-scoped API key minting via `POST /v1/api-keys` (new gateway route, simpler for programmatic/server-to-server agents). Once this decision is made and implemented (1–5 days depending on choice), all 26 tools become callable immediately. (Doc 15, Section 5; Unknown C-05)

---

## Critical Unknowns Summary

The five most blocking unknowns from the 15 Critical items in Doc 19:

**C-01: Preset activation API does not exist** — The entire adaptive theme system depends on `POST /v1/themes/:slug/apply-preset`. Without it, presets are data with no effect. All downstream work (vertical preset definitions, MCP `apply_preset`, AI onboarding) is blocked. Resolution: 3–5 days (endpoint + adapter method + merchant-control-plane wiring). Must be resolved before writing any preset JSON.

**C-03: No definitive LetBuyy Core theme handle** — Every store compiled to Liquid uses Urban Kicks as the base. `getDefaultStorefrontThemeTemplate()` hardcodes `themeId: 'urban-kicks'`. The web wizard sends `theme_id = 'modern'` (possibly a ghost DB reference). Without a `letbuyy-core` bundle, preset activation has no well-typed target. Resolution: rename `createUrbanKicksLiquidThemeBundleFixture()`, update `compilePortableToLiquidBundle()` and `getDefaultStorefrontThemeTemplate()`. 2–3 days. Must be the first code change in Phase B.

**C-05: AI agent authentication strategy undefined** — Without a decided and implemented auth path, none of the 26 ready-now MCP tools can make authenticated gateway calls. Two options exist (OAuth PKCE vs API key minting); neither is implemented. Resolution: 0.5 days to decide; 1–5 days to implement. Must be decided before MCP server development begins.

**C-06: Font loading absent from theme engine** — `headingFontFamily` and `bodyFontFamily` settings accept font name strings but no font loading mechanism exists. Typography-forward presets (fashion, jewelry, dairy) will silently fall back to `system-ui`, losing 40–50% of their visual differentiation. Resolution: add `LIQUID_THEME_FONT_MAP` and font injection to `buildLiquidThemeHeadAssets()`. 1–2 days.

**C-15: Vertical capture missing from web onboarding** — The `Step4Schema` with `industry`, `brand_tone`, `business_goal` exists in `packages/tenant-core` but is never wired into the web wizard. Without vertical data at onboarding, AI theme selection, preset auto-application, and AI content generation have no input. Every web-created store gets generic `theme_id = 'modern'` regardless of what the merchant sells. Resolution: add Step 1.5 vertical picker to `onboarding/page.tsx`. 0.5 days to design; 2–4 days to implement.

---

## Architectural Decisions Required

These decisions cannot be resolved by research. They require humans to choose between options with real tradeoffs. Each decision blocks specific Phase B initiatives.

| Decision | Options | Recommendation | Who Decides | Deadline |
|---|---|---|---|---|
| Single Core theme vs multiple base themes | (A) One `letbuyy-core`, all verticals via presets. (B) Separate base bundles per vertical cluster. | Option A strongly — the codebase scaffolds toward this. Extension themes (Model C) are the right path for new sections, not base bundle proliferation. | Engineering lead + ARB | Before any bundle work begins |
| Preset format: settings-only vs full template override | (A) `settings_data.current` delta only (colors, fonts). (B) Full template override (section order + settings + blocks + settings delta). | Option B — settings-only presets produce a recognizably generic storefront; full template override achieves vertical differentiation. | Engineering lead | Before Day 10 |
| Preset activation: draft-only vs auto-publish | (A) Preset writes to draft; merchant publishes manually. (B) Preset applies directly to live storefront. | Option A (draft-only) — any configuration mistake should be reviewable before live publish. | Product lead | Before Day 10 |
| MCP authentication: OAuth PKCE vs API key minting | (A) OAuth 2.0 PKCE using existing ES256 JWT infrastructure. (B) Long-lived store-scoped API key exchanged for short-lived ES256 JWT per call. | Option B for server-to-server MCP calls; Option A for browser-embedded AI agents. | Security lead + Engineering lead | Before Day 31 |
| 80% preset vs full preset for first three verticals | (A) Use only existing section types (achievable immediately). (B) Build missing vertical-specific sections before writing presets. | Option A for Phase B launch — grocery/electronics/fashion have fully functional 80% presets with existing sections. Phase D adds the missing section types. | Product lead | Before Day 10 |
| Font loading strategy | (A) Google Fonts via `<link rel="stylesheet">`. (B) Self-hosted WOFF2 in Supabase Storage/R2. (C) System font stack only. | Option A for Phase B/C (move to B if DPDP Act 2023 data residency requirements surface for Indian merchants). | Engineering lead + Privacy review | Before Day 15 |
| Marketplace model | (A) Traditional bundle marketplace. (B) Preset marketplace (JSON configs only). (C) Hybrid (core + extensions + presets). | Phase 1 = Model B; long-term = Model C. Model A has structural launch blockers (no automated promotion pipeline, no Lighthouse job). | Product lead + ARB | Before marketplace ARB submission |

---

## Recommended Immediate Actions (Next 2 Weeks)

From Doc 20, Tier 1 (Days 1–30), ordered by dependency:

1. **Day 1 — Verify `theme_id = 'modern'` is a valid `themes` row.** Run `SELECT slug, is_active FROM themes WHERE slug = 'modern'` on the dev/production DB. If no row exists, the merchant editor load may be failing silently for all web-created stores. This is a 30-minute diagnostic that gates everything else. (Unknown C-08)

2. **Day 1 — Test the postMessage bug in the theme editor dev environment.** Open the theme editor, click a React-rendered section in the preview pane. If the sidebar does not select the section, the bug is confirmed for React as well as Liquid. If confirmed, treat as Day 1 emergency fix, not a Week 3 task — preset application is invisible to merchants who cannot click-to-select. (Unknown C-04)

3. **Days 1–3 — Create `createLetbuyyCoreLiquidThemeBundleFixture()`.** Rename the function in `theme-bundle.ts`, update `package.slug` to `'letbuyy-core'`, fix the `<title>` and `<body class>`, change `storeName` defaults to `'{{ shop.name }}'`, neutralize hero/newsletter copy, remove fashion-specific category blocks. Update `compilePortableToLiquidBundle()` and `getDefaultStorefrontThemeTemplate()`. This stops Urban Kicks branding from being injected into every merchant storefront.

4. **Days 2–3 — Write `ThemePresetDocumentSchema` Zod type.** Define the canonical preset document schema in `theme-bundle.ts` with fields: `id`, `name`, `description`, `vertical`, `settings_data` (delta to `settings_data.current`), `templates` (full `ThemeBundleTemplateSchema` map), `metadata.requires_sections`, `metadata.missing_sections_for_full_preset`. Validate against a grocery preset draft before proceeding.

5. **Days 3–5 — Write grocery, electronics, and fashion preset definitions.** The complete JSON for all three is fully specified in Doc 11 (Section 5 and Section 8). Populate `settings_data.presets` in `createLetbuyyCoreLiquidThemeBundleFixture()` with these three validated preset objects.

6. **Days 5–7 — Implement `POST /v1/themes/:slug/apply-preset`.** Add `applyPreset(storeId, presetKey, mergeMode)` to `ThemeExecutionAdapter`. Add the route to `themes.ts` with `verifySiteOwnership` guard. Pre-flight: verify all `preset.metadata.requires_sections` exist in the active bundle. Write to draft only (do not auto-publish). This is the single highest-leverage API addition in Phase B.

7. **Days 7–8 — Fix postMessage type-name inconsistency and wire rollback button.** Standardize on canonical event names in both `CenterPanel.tsx` and `editor-preview-section-frame.tsx`. Add rollback `<Button>` to `VersionTree.tsx`. These are 1-day combined UI fixes that restore critical editor UX before preset preview work begins.

8. **Days 8–10 — Add Google Fonts loading to the renderer.** Add `LIQUID_THEME_FONT_MAP` to `theme-renderer.ts`. Update `buildLiquidThemeHeadAssets()` to emit `<link rel="preconnect">` and `<link rel="stylesheet">` for known non-system fonts. Change `headingFontFamily`/`bodyFontFamily` schema field type to `select` with 8–10 curated Google Fonts options. Flag for privacy review before production deploy.

9. **Days 9–12 — Implement Liquid editor bridge script.** Create `liquid-editor-bridge.ts` (plain JS, not React), inject it in `composition-engine.tsx` when `editorMode=true && liquid_ready=true`, add `data-section-id` wrapper attributes to all Urban Kicks Liquid section templates. This completes the bidirectional click-to-select protocol for Liquid themes.

10. **Days 10–14 — Decide MCP authentication strategy.** This is a product + security decision, not an engineering task. Once decided, implementation is 1–5 days. The decision gates the 7-tool MCP server build (Days 31–38) — the decision must be made before the MCP sprint begins.

---

## What to NEVER Build Without Resolving First

These are specific warnings from the discovery — initiatives that appear straightforward but have hidden blockers that will cause wasted work or production incidents:

**Never write vertical preset JSON before `ThemePresetDocumentSchema` is defined.** If the schema changes after presets are written (which it will if schema design happens after data authoring), every preset definition must be rewritten. The schema is a 1-day design task; skipping it to "move faster" adds 2–3 days of rewrite. (Unknown C-02)

**Never ship dairy or restaurant preset configurations to merchants.** The subscriptions domain is confirmed NOT IMPLEMENTED (LCIS v11). A dairy preset implies recurring delivery subscription orders. A restaurant preset implies delivery slot booking and menu modifiers. The platform cannot fulfill these expectations. Marketing these verticals without clear "coming soon" gating will cause merchant churn and support load. (Doc 13 dairy/restaurant gap analysis; Risk R-07)

**Never flip `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = true` without the ARB evidence package.** The governance constant `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status = 'deferred'` is a deliberate governance constraint. Flipping without a render parity matrix, SSTI/XSS gate results, and P95 latency benchmarks violates the governance model and creates a production regression risk with no safety net. (Doc 20, Tier 3)

**Never add Liquid editor bridge script before fixing the postMessage type-name inconsistency.** The bridge script uses the same postMessage event names. If the canonical names are established wrong in the bridge and then corrected in a follow-up fix, the bridge must be updated too. Fix the names first, then implement the bridge. (Doc 17, Section 4; Unknown C-04)

**Never publish AI-generated policy pages without a visible legal disclaimer.** AI-generated privacy policies, return policies, and terms of service are generic English templates that may not comply with the Consumer Protection Act 2019, IT Act 2000, or DPDP Act 2023. Every AI-generated policy page must display: "This is a template generated by AI. Review with a qualified legal professional before publishing." Do not auto-publish AI-generated policies. (Risk R-04 in Doc 19 and Doc 20)

**Never build the theme marketplace before ARB reopen approval.** The `deploymentAuthority.platform = "frozen-not-deployed"` in `runtime.manifest.json` is an ARB-enforced constraint. Code changes to `apps/theme-marketplace` before approval violate governance. The nine operational items (Vercel project, secrets, GSTIN, payout wiring) are the correct unlock path, not code changes. (Unknown C-10)

**Never implement an MCP tool that auto-publishes themes without merchant confirmation.** The `POST /v1/themes/:slug/publish` action purges the Cloudflare cache and writes an immutable `theme_releases` row. An MCP tool that publishes without merchant confirmation can irreversibly change a live storefront. All publish actions must be explicitly user-approved — the MCP tool generates a preview URL and waits for the merchant to confirm before calling publish. (Doc 14, Section 6 Tier 2)

---

## Cross-Reference: Phase A Research Phase B Discovery

Phase A (docs/theme-research/) established the theme system inventory, Liquid engine analysis, editor analysis, marketplace analysis, and adaptive theme architecture. Phase B confirms, extends, and in some cases contradicts those findings:

**Confirmed by Phase B:**
- Phase A identified Urban Kicks as a first-class Liquid theme with 40 sections. Phase B (Doc 10) confirms this and maps the exact 13 fields that constitute Urban Kicks-specific branding, showing the generalization path is shallower than expected.
- Phase A identified the preset system as aspirational. Phase B (Doc 11) confirms the four-layer data model that can express any preset as pure JSON and provides complete per-vertical section order specifications ready to implement.
- Phase A identified the marketplace as frozen. Phase B (Doc 16) confirms this and evaluates three future models against India-first requirements, providing a weighted recommendation (Model B first, then Model C).

**Extended by Phase B:**
- Phase A counted section types. Phase B (Doc 11) maps which specific section types are missing per vertical and whether they are blockers or deferrables for MVP presets, enabling per-vertical build-vs-defer decisions.
- Phase A identified the theme editor as lacking AI integration. Phase B (Doc 17) specifies the exact three-phase editor evolution path (Phase 1: quick wins including the postMessage fix; Phase 2: preset + design system; Phase 3: AI-collaborative editor) with concrete file-level changes.
- Phase A documented the store creation flow. Phase B (Doc 18) maps four exact hook points in `onboarding/page.tsx` and `create-store/route.ts` where AI intent generation can be injected with zero regression risk to the current path.
- Phase A noted the MCP opportunity. Phase B (Doc 15) quantifies it precisely: 26 of 31 tools are callable today with no new backend work, lists the exact 5 that are not, and provides effort estimates for each gap.

**Contradicted by Phase B:**
- Phase A described Urban Kicks as a demo/fixture theme. Phase B (Doc 10) reveals it is used as the base for ALL Liquid-compiled stores via `compilePortableToLiquidBundle()`, making it a production concern, not just a reference implementation.
- Phase A suggested the preset system needed significant design work. Phase B (Doc 11 Section 8) shows the activation algorithm is a 20-line function once the schema is defined — the data model is already complete in `ThemeBundleSettingsDataSchema.passthrough()`.
- Phase A implied the editor rollback was complete. Phase B (Doc 17 Section 2) confirms the rollback API is complete but the UI button is not wired — the feature is one day of UI work from being usable.
- Phase A described the navigation API as needing investigation. Phase B (Doc 13, Section 7) confirms it is fully implemented: `PUT /v1/pages/navigation/:location` does a full replace, `ensureNavigationMenu()` auto-creates the menu row, and `syncPageNavigationItem()` auto-adds pages to nav on creation — an already-complete API that AI store generation can use immediately.
