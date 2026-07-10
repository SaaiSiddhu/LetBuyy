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
- **Why it matters for M→AE:** Phase **W** adds new theme tenant tables (custom-data). Those additions MUST be registered so they add **no new** tenant-isolation violation. Phase P reused existing registered tables (`theme_editor_drafts` at :2774, `theme_instance_drafts` at :2786, `theme_releases` at :2819) and added no new table requiring registry update. Regenerating the registry may pull in foreign schema WIP, so registry changes must be staged surgically (only the program's own table rows) or the generator run and its diff reviewed against program scope.
- **Owner:** foreign — whoever holds the uncommitted tenant-schema WIP. Program will not fix foreign drift; it will avoid adding to it.

## Data / migrations

### RISK-DATA-001 — Migrations 186/187 are untracked WIP; 188/189/190 require production apply — [MEDIUM]
- **Status:** OPEN · foreign (186/187) + committed-but-unapplied (188/189/190).
- **Evidence:** `git log -- database/supabase/migrations/186_*.sql` and `187_*.sql` return empty (untracked). `188_letbuyy_core_theme_row.sql` committed in `40741cb8` (idempotent `INSERT … ON CONFLICT (slug) DO NOTHING`); the `letbuyy-core` DB row does not exist until 188 runs against the DB. Migration 187 (`sites.site_settings`) is referenced by `storefront-runtime` `mapSupabaseToStore` — a real deployment risk if the DB is reset before it is committed/applied. Migration 189 (`189_theme_persistence_idempotency.sql`, committed in Phase P) adds nullable `idempotency_key` + partial unique index to `theme_releases`; additive and safe to apply, but MUST NOT be applied to production without ARB sign-off. Migration 190 (`190_theme_library_q.sql`, committed in Phase Q) adds `owned_by_site_id uuid NULL` + `is_site_private boolean DEFAULT false` to `themes` plus two indexes; additive and idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`), but MUST NOT be applied to production without ARB sign-off. Rollback of 189 or 190 requires `DROP COLUMN` (ARB-repaired).
- **Disposition:** program authors migrations for its own phases and tests them locally/staging only; it does NOT apply migrations to production and does NOT commit foreign migrations 186/187. Apply order: 186 → 187 (untracked, foreign) → 188 → 189 → 190.

## Phase P risks

### RISK-SEC-P01 — `theme_editor_drafts` RLS policies check `user_id` only, not `custom_user_id` — [MEDIUM]
- **Status:** OPEN · pre-existing (not introduced by Phase P).
- **Evidence:** `database/supabase/migrations/000_baseline.sql:12618` — `theme_editor_drafts` table; 4 RLS policies (SELECT / INSERT / UPDATE / DELETE) all scoped to `EXISTS(SELECT 1 FROM sites WHERE sites.id = theme_editor_drafts.store_id AND sites.user_id = auth.uid())`. The `custom_user_id` column on `sites` is not checked. Contrast with `theme_instance_drafts_owner_manage` which correctly checks `(sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())`.
- **Why it matters:** Merchants who authenticate via `custom_user_id` (the primary identity path in this platform) cannot perform direct client-side reads/writes against `theme_editor_drafts` under their own auth token. Today the gateway bypasses via `service_role` so no live route relies on these RLS policies for protection. But any future client-side subscription or realtime listener would silently fail for `custom_user_id` merchants.
- **Disposition:** Discovered in Phase P security review. Not patched (pre-existing baseline change; requires careful migration + RLS update). Phase R and Phase S both did not add any client-side realtime subscription over `theme_editor_drafts`, so the risk remains bounded to the gateway service-role path. **Target:** dedicated security migration before any realtime subscriptions are added over `theme_editor_drafts`, or earliest phase that adds client-side `theme_editor_drafts` access. Owner: security / Phase T architect.

### RISK-TOCTOU-P01 — Publish idempotency pre-check has a concurrent-window TOCTOU gap — [LOW]
- **Status:** OPEN · known residual; ARB-gated.
- **Introduced:** Phase P (2026-07-10).
- **Evidence:** `services/api-gateway/src/execution/theme-execution.adapter.ts` — `publish()` idempotency pre-check at ~line 1420 and post-enrich UPDATE at ~line 1431. Two truly concurrent publishes within the ~1-5ms window can both pass the TS pre-check before either write lands. Both call `publish_theme_release` RPC. The partial unique index on `(store_id, idempotency_key)` prevents a second keyed record from persisting, but the RPC runs twice and may create one keyless ghost release in `theme_releases`.
- **Why it matters:** A ghost release inflates release history and can race the `is_current` pointer. Sequential-retry case (dominant real-world pattern) is correctly handled by Phase P.
- **Disposition:** Full closure requires adding `p_idempotency_key` parameter to the `publish_theme_release` SECURITY DEFINER RPC with `ON CONFLICT` — ARB-gated. **Target:** ARB follow-up; earliest phase that touches the SECURITY DEFINER RPC. Documented at code level in the adapter.

### RISK-TOCTOU-P02 — Rollback CAS is TS-level only; concurrent rollbacks race `is_current` — [LOW]
- **Status:** OPEN · known residual; ARB-gated.
- **Introduced:** Phase P (2026-07-10).
- **Evidence:** `services/api-gateway/src/execution/theme-execution.adapter.ts` — `rollbackRelease()` CAS guard at ~line 1516-1529. The guard checks `is_current` in a `SELECT` before calling `publishReleaseSnapshot`. Two concurrent rollbacks both passing the same TS check window can both call the RPC; the second write wins the `is_current` pointer.
- **Why it matters:** Two rollback operations in flight simultaneously can produce an unintended final state where the `is_current` pointer points to whichever rollback's release was committed last, which may not be the one the merchant intended.
- **Disposition:** Full closure requires adding `p_expected_current_release_version` to the SECURITY DEFINER RPC for an atomic CAS at the Postgres level — ARB-gated. **Target:** ARB follow-up. Documented at code level in the adapter. Sequential rollback case (the realistic pattern) is correctly handled by Phase P's optional `expected_current_release_id` field.

## Phase Q risks

### RISK-TOCTOU-Q01 — Plan limit enforcement is non-atomic (count-then-insert race) — [MEDIUM]
- **Status:** OPEN · known residual; ARB-gated for full closure.
- **Introduced:** Phase Q (2026-07-10).
- **Evidence:** `services/api-gateway/src/routes/themes.ts` — `POST /themes/library/create` and `POST /themes/:slug/duplicate` handlers call `countInstalledSiteThemes` and then `service.createSiteTheme` / `service.duplicateSiteTheme` as two separate DB round-trips with no advisory lock or DB-level CHECK constraint. `countInstalledSiteThemes` counts `theme_instances WHERE store_id=storeId AND instance_status NOT IN ('archived','deleted') AND deleted_at IS NULL`. There is no UNIQUE constraint or row-level lock bounding the gap between the count read and the insert.
- **Why it matters:** Two concurrent create or duplicate requests for the same store that both read `count < limit` before either write completes will both succeed, allowing the store to exceed its billing-tier theme cap by one or more. The window is narrow (~1-5ms per round-trip); sequential requests (the dominant real-world pattern) are correctly blocked once the count reaches the limit.
- **Disposition:** Full closure requires either (a) a `SECURITY DEFINER` RPC wrapping the count + insert in a transaction with a per-store advisory lock (`pg_advisory_xact_lock(hashtext(store_id))`), or (b) a DB-level `CHECK` constraint on `theme_instances` referencing a materialized count. Both require ARB sign-off (SECURITY DEFINER touch or schema constraint addition). Documented at code level in the route handlers.
- **Target:** Phase AB (theme versioning) or an earlier ARB-gated follow-up, whichever first touches the `theme_instances` schema or `publish_theme_release` SECURITY DEFINER surface.

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

## Phase S risks

Phase S introduced no new open risks. All 8 findings (1 HIGH, 2 MEDIUM, 5 LOW) were resolved in the hardening pass before phase close.

**Cleared by Phase S hardening (not registered as ongoing risks):**

| Severity | Finding | Resolution |
|---|---|---|
| HIGH | `INSPECTOR_ADD_SECTION_INTENT` unhandled in `CenterPanel.handleMessage` | `case INSPECTOR_ADD_SECTION_INTENT` added with full payload validation |
| MEDIUM | Bridge receive guard fail-open when `NEXT_PUBLIC_ADMIN_URL` absent | Changed to `!editorOrigin \|\| event.origin !== editorOrigin` — fail-closed |
| MEDIUM | Double-scroll jank: both `LEGACY_SELECTION_MESSAGE` and `SCROLL_MESSAGE` triggered `shouldScroll=true` | `LEGACY_SELECTION_MESSAGE` now calls `selectSection(id, false)` |
| LOW | READY_MESSAGE fell back to `'*'` when env var absent | Suppressed (not `'*'`) with `console.warn` |
| LOW | Inspector chip CSS used raw px/hex | Replaced with `--lb-*` tokens throughout |
| LOW | Insert-button CSS used raw `rgb()` colors | Replaced with `var(--lb-color-interactive/hover/focus-ring)` |
| LOW | No `prefers-reduced-motion: reduce` guard on flash animation | Guard added |

## Phase R risks

### RISK-R01 — Local type mirrors in `page.tsx` and `SectionTreePanel.tsx` will drift — [LOW]
- **Status:** CLOSED · partially resolved in Phase T (2026-07-11).
- **Introduced:** Phase R (2026-07-10). **Closed:** Phase T (2026-07-11).
- **Resolution:** Phase T added `children?: BlockEntry[]` to the `BlockEntry` type in `SectionTreePanel.tsx`, making `SectionTreePanel.tsx` the canonical owner of `BlockEntry`. The three new child callbacks (`onAddChildBlock`, `onRemoveChildBlock`, `onMoveChildBlock`) are defined on `SectionTreePanelProps` with optional typing, so `page.tsx` does not need to be touched to remain compatible. The full extraction of all five shared types (`SectionEntry`, `BlockEntry`, `EditorState`, `EditorSelection`, `AvailableSection`) to a shared module was not performed because `page.tsx` (foreign WIP) was deliberately not touched. The structural-drift risk for `BlockEntry` is eliminated by Phase T's canonical definition. The risk for the remaining four types remains as low ongoing tech debt but is not re-registered as a separate open risk — it will be addressed when `page.tsx` is next touched for a required feature change.

## Phase T risks

### RISK-T01 — Pre-Zod stack-depth attack via `z.lazy()` recursion — [MEDIUM]
- **Status:** OPEN · known residual; deferred.
- **Introduced:** Phase T (2026-07-11).
- **Evidence:** `packages/theme-engine/src/theme-bundle.ts:1420` — `parseLiquidThemePackageBundle` calls `LiquidThemePackageBundleSchema.parse(input)` directly without a pre-Zod structural depth check. `ThemeBundleTemplateBlockSchema` is self-recursive via `z.lazy()`. A crafted bundle JSON with extreme nesting depth (e.g., 100 levels, achievable within the request body size before Cloudflare's generic limits apply) would overflow the V8 call stack during Zod's `_parse` recursion before the `superRefine` depth check fires, producing a `RangeError: Maximum call stack size exceeded`. `parseThemeDocument` has the same gap: `assertNoBlockedKeysInRaw` (which runs pre-Zod) checks key blocklist at depth-128 but does not limit structural depth.
- **Why it matters:** An authenticated merchant (or a crafted bundle file in an upload flow) could trigger a Worker crash via a deep-nesting attack. Cloudflare Worker per-request CPU limits and memory limits provide some containment, but a RangeError is less clean than a 400 ZodError and may interfere with error handling pipelines.
- **Disposition:** Full closure requires adding a fast iterative pre-Zod structural depth check to `parseLiquidThemePackageBundle` (after `assertNoBlockedKeysInRaw`-style call) and optionally to `parseThemeDocument`. Additionally, adding an explicit `bodyLimit` middleware to the theme package upload route reduces blast radius. Deferred from Phase T to avoid touching production parse paths without dedicated test coverage for the pre-check logic in the bundle context.
- **Target:** Earliest phase touching `parseLiquidThemePackageBundle` or the upload route.

### RISK-T02 — No `assertNoBlockedKeysInRaw` in `parseLiquidThemePackageBundle` — [MEDIUM]
- **Status:** OPEN · known residual; deferred.
- **Introduced:** Phase T (2026-07-11).
- **Evidence:** `packages/theme-engine/src/theme-document.ts:493` calls `assertNoBlockedKeysInRaw(input)` before `ThemeDocumentSchema.parse(input)`. `packages/theme-engine/src/theme-bundle.ts:1420` (`parseLiquidThemePackageBundle`) does NOT call `assertNoBlockedKeysInRaw`. Phase T introduced nested block settings (`ThemeBundleTemplateBlockSchema.blocks[id].settings`) parsed via `z.record(z.string(), ThemeBundleJsonSchema)`. A key `"__proto__"` in block settings will invoke the prototype setter on the parsed output object, silently changing its `[[Prototype]]`. The downstream `filterBlockedSettingsKeys` in the renderer never sees `__proto__` via `Object.keys` because V8 does not return it from `Object.keys` after a prototype mutation.
- **Why it matters:** An attacker-supplied `block.settings.__proto__` value could expose attacker-controlled inherited properties via `{{ block.settings.admin }}` in a Liquid template. Impact is bounded to the merchant's own storefront; no cross-tenant blast radius.
- **Disposition:** Fix: call `assertNoBlockedKeysInRaw` (already exported from `theme-document.ts`) at the top of `parseLiquidThemePackageBundle`. One-line call site change; no schema-level side effects. Deferred from Phase T to avoid touching the production parse path without dedicated bundle-context test coverage.
- **Target:** Earliest phase touching `parseLiquidThemePackageBundle`.

### RISK-T03 — Block settings bypass `filterBlockedSettingsKeys` in the renderer — [LOW]
- **Status:** OPEN · defence-in-depth gap; deferred.
- **Introduced:** Phase T (2026-07-11). Pre-existing for flat blocks; Phase T's `sub_blocks` threading adds a second unfiltered position.
- **Evidence:** `packages/theme-engine/src/theme-renderer.ts:818` — `settings: block.settings` and `theme-renderer.ts:824` — `settings: child.settings` (in `sub_blocks[]`) are inserted raw into the Liquid scope without calling `filterBlockedSettingsKeys`. The `BLOCKED_DROP_KEYS` set (which excludes `api_key`, `webhook_secret`, etc.) is applied only to the global `settings` drop (line 883), not to block-level settings.
- **Why it matters:** Credential-named keys in merchant-authored `block.settings` are accessible via `{{ block.settings.api_key }}` without the blocked-key guard. All rendered HTML passes through DOMPurify but non-HTML-encoded plain strings are not stripped.
- **Disposition:** Fix: apply `filterBlockedSettingsKeys` to `block.settings` and `child.settings` at their Liquid scope insertion points. This is defence-in-depth; no legitimate theme uses credential-adjacent key names in block settings.
- **Target:** Phase U (settings control renderer) — fix before adding new settings field types.

### RISK-T04 — `RENDERER_MAX_BLOCK_DEPTH` is private/unexported — depth parity test cannot directly assert it — [LOW]
- **Status:** OPEN · test quality gap; deferred.
- **Introduced:** Phase T (2026-07-11).
- **Evidence:** `RENDERER_MAX_BLOCK_DEPTH = 3` is a private module-local constant in `theme-renderer.ts:950`. The test `nested-blocks: (f) RENDERER_MAX_BLOCK_DEPTH === MAX_BLOCK_NESTING_DEPTH` asserts `MAX_BLOCK_NESTING_DEPTH === 3` and `MAX_BUNDLE_BLOCK_NESTING_DEPTH === 3` but cannot directly assert the renderer constant. If the renderer constant were changed to 2, the test would still pass.
- **Disposition:** Fix: export `RENDERER_MAX_BLOCK_DEPTH` from `theme-renderer.ts` and add a direct equality assertion. Alternatively, add a behavioral test that renders a depth-3 fixture and verifies all three levels produce non-empty `sub_blocks`.
- **Target:** Phase U or first phase touching `theme-renderer.ts`.

### RISK-T05 — `allowedChildTypes` not passed from `SectionTreePanel` to `BlockChildRow` — add-child button dead — [MEDIUM]
- **Status:** OPEN · functional gap; deferred.
- **Introduced:** Phase T (2026-07-11).
- **Evidence:** `apps/merchant-control-plane/src/components/theme-editor/SectionTreePanel.tsx:267–279` — the `BlockChildRow` call at depth-1 does not pass `allowedChildTypes`. `BlockChildRow.tsx:143–146` computes `canAddChildren = depth < MAX_EDITOR_BLOCK_DEPTH && Array.isArray(allowedChildTypes) && allowedChildTypes.length > 0`. Since `allowedChildTypes` is always `undefined` at depth-1, `canAddChildren` is always `false` and the add-child button never renders.
- **Why it matters:** The Phase T add-child affordance is non-functional for all merchants. The three child callbacks (`onAddChildBlock`, `onRemoveChildBlock`, `onMoveChildBlock`) are wired but the add-child entry point is dead.
- **Disposition:** Fix: at the `BlockChildRow` call site in `SectionTreePanel.tsx`, resolve `allowedChildTypes` from `schema?.blocks_schema?.[block.type]?.allowed_child_types ?? undefined`. The `schema` and `blocks_schema` lookup are already used at that call site for `blockLabel` resolution — the fix is a one-prop addition.
- **Target:** Phase U or first phase touching `SectionTreePanel.tsx`.

### RISK-T06 — `UnsupportedThemeDocumentFeatureError` exported but never thrown — [LOW]
- **Status:** OPEN · dead API; deferred.
- **Introduced:** Phase N (2026-07-10). Became dead in Phase T (2026-07-11).
- **Evidence:** `packages/theme-engine/src/theme-document.ts:89–97` — `UnsupportedThemeDocumentFeatureError` is defined and exported. It was previously thrown by the Phase N fail-closed guard in `fromThemeDocumentV2` (lines 560–573, pre-Phase-T). That guard was removed in Phase T. A `grep` across all app and service source confirms no external catch sites for this class; it is dead public API.
- **Disposition:** Either re-purpose with updated JSDoc ("reserved for future phase-gated feature flags") or remove the class and its export entirely. Removal is safe since no catch sites exist.
- **Target:** Phase U or first theme-document.ts touch.

## Phase N risks

### RISK-DUAL-N01 — `section_definitions` / `block_definitions` dual-truth risk in Phase R-S editor — [MEDIUM]
- **Status:** OPEN · mechanically guarded in Phase R; must be preserved in Phase S+.
- **Introduced:** Phase N (2026-07-10). Partially mitigated Phase R (2026-07-10).
- **Evidence:** `ThemeDocumentSchema` embeds `section_definitions` (= bundle's `sections` Liquid source files) and `block_definitions` (= bundle's `blocks` Liquid source files). If the Phase R-S editor mutates these fields when saving a draft, the embedded Liquid source would diverge from the canonical theme package version in the DB. Phase N marks these fields READ-ONLY in code comments (`packages/theme-engine/src/theme-document.ts` lines 285–297) but does not mechanically prevent editor mutation.
- **Why it matters:** A divergent `section_definitions` would mean `fromThemeDocumentV2` produces a bundle with different Liquid source than what the theme package was published with — silently different rendering behaviour for the same theme version.
- **Mechanical backstop:** `fromThemeDocumentV2` calls `parseLiquidThemePackageBundle(raw)` as its last step. If `section_definitions` has been mutated so that template section types no longer match, the `superRefine` on the bundle will reject the document before it reaches persistence.
- **Phase R mitigation:** `buildDraftConfig(baseConfig, themeId, editorState, selectedTemplateKey)` in `page.tsx` always merges the mutable `editorState` (template/settings) over `baseConfig`. The immutable `section_definitions` and `block_definitions` come from `baseConfig` (loaded from the API at editor open), never from `editorState`. No Phase R code path writes these fields from editor state. The `EDITOR_GUIDE.md` section "8.5 baseConfig and RISK-DUAL-N01" documents this constraint explicitly.
- **Phase S mitigation (inspector):** `INSPECTOR_ADD_SECTION_INTENT` carries only `{ adjacentSectionId, position }` — no section object, no Liquid source, no template mutation. `EditorPreviewSectionFrame.sendAddIntent()` has no access to `template.sections`. Contract test "section frame never mutates template sections" asserts `sections.push / splice / filter` are absent from the file. The editor (`CenterPanel.handleMessage` → `onAddSectionIntent?.(...)`) receives the intent and is responsible for any section mutation through the normal `applyChange()` + `buildDraftConfig()` path.
- **Disposition:** Mechanically enforced through Phase S. Phase T (section groups + nested blocks) and all subsequent editor phases MUST NOT add a mutation path for `section_definitions` or `block_definitions`. Any future feature that needs to update Liquid source must go through the theme package publish pipeline, not the draft save path.
- **Target:** ONGOING — all editor phases from T onward.

### RISK-ARCH-N01 — Forward-compat gap: `.strict()` + version gate requires version bump for future schema additions — [LOW]
- **Status:** OPEN · ongoing process requirement.
- **Introduced:** Phase N (2026-07-10).
- **Evidence:** `ThemeDocumentSchema` uses `.strict()`. Any future phase that adds new top-level fields to `ThemeDocumentSchema` without bumping `THEME_DOCUMENT_VERSION` and adding it to `KNOWN_THEME_DOCUMENT_VERSIONS` will silently strip those new fields when Phase N code reads a Phase-AA-written document from the DB. The Zod `.strict()` mode strips unknown fields on parse without error.
- **Why it matters:** A Phase-AA document written by a newer editor could have fields silently dropped when read by any code that has not been updated to the new version. The stripped document would then pass all schema checks and appear valid, masking the data loss.
- **Disposition:** Every phase that adds fields to `ThemeDocumentSchema` MUST: (1) bump `THEME_DOCUMENT_VERSION` to a new string, (2) add the new version to `KNOWN_THEME_DOCUMENT_VERSIONS`, (3) write a `migrateToThemeDocumentV2`-style upgrade function for old-version docs. This is a process rule, not a code enforcement. Phase AA (Custom CSS + code workspace) is the most likely next adder.
- **Target:** Phase AA (Custom CSS + code workspace) and any phase that modifies `ThemeDocumentSchema`.

### RISK-PERF-N01 — Large document size: ThemeDocument may exceed 8MB for complex themes — [LOW]
- **Status:** OPEN · partially mitigated in Phase R; hard bound deferred to Phase S.
- **Introduced:** Phase N (2026-07-10). Partially mitigated Phase R (2026-07-10).
- **Evidence:** `ThemeLiquidSectionFileSchema` allows source up to 200kB per section file (enforced in `theme-bundle.ts`). Urban Kicks has ~40+ section definition files. A full `ThemeDocument` for a complex theme can approach 8MB of JSONB. Deserializing 8MB on every editor load is a performance concern; Supabase JSONB has no hard column-size limit but large payloads increase query latency and memory pressure.
- **Why it matters:** Editor load and draft save are on the critical path for merchant editing latency. An 8MB serialization/deserialization cycle on each section drag or setting change would cause visible lag.
- **Phase R mitigation:** `buildDraftConfig` sends only the mutable state (template/settings JSON) in the draft POST body, not the full `ThemeDocument`. `section_definitions` / `block_definitions` (Liquid source) come from `baseConfig` and are not re-serialized from the Liquid source on each autosave cycle. This substantially reduces the per-save payload for complex themes.
- **Remaining gap:** No hard `superRefine` total-source-byte bound has been added. The draft endpoint still receives the full `draftConfig` which includes `section_definitions` as stored in `baseConfig`. For a 40+-section theme, this can still be large on the first load.
- **Mitigation candidates remaining:** (a) Total `section_definitions` source byte bound in `ThemeDocumentSchema.superRefine`. (b) Split representation: mutable template/settings in `theme_editor_drafts`, immutable Liquid source in the theme package row (load separately, never in the draft PUT body).
- **Phase S note:** Phase S did not add a hard byte bound. The `buildDraftConfig` mitigation from Phase R remains active. The split-representation approach (candidate (b)) is still the preferred long-term mitigation.
- **Target:** Phase T (section groups) or a dedicated performance pass.
