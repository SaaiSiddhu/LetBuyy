# M→AE Program — Risk Register

Living register. Each entry: ID · severity · status · evidence · owner/target phase.

## Security / tenancy

### RISK-SEC-001 — `theme_purchases` has wide-open RLS (`USING (true)` / `WITH CHECK (true)`) — [HIGH]
- **Status:** FIXED in Phase AE — Migration 191 committed; **ARB-gated for production apply.**
- **Evidence (defect):** `database/supabase/migrations/000_baseline.sql` — `theme_purchases` table at `:12820`; RLS policies `USING (true)` at `:24201` and `WITH CHECK (true)` at `:24159` (surfaced by the Phase M security-tenancy inventory, claim CL-20, verified). Both policies omit a `TO` clause, making them effective for PUBLIC (anon + authenticated + service_role). No migration 073–190 narrows either policy.
- **Why it mattered:** violates the tenancy invariant (no public `USING (true)` on tenant tables). Any future route over `theme_purchases` would leak cross-tenant purchase rows.
- **Remediation (Phase AE):** `database/supabase/migrations/191_theme_purchases_rls_tenant_scope.sql` (NEW, 93 lines) drops both wide-open policies and replaces them with: (1) `tp_service_role FOR ALL TO service_role USING(true)` — explicit gateway pass-through, matches migration 163 D2 pattern; (2) `tp_authenticated_select FOR SELECT TO authenticated USING (user_id = auth.uid())`; (3) `tp_authenticated_insert FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())`. Idempotent (DROP IF EXISTS). Migration-safety-validator PASS.
- **Architecture note:** `theme_purchases.user_id` FK → `users_custom(id)`, a separate UUID space from `auth.uid()`. The effective posture is that direct authenticated-role clients cannot browse other users' purchase rows. Gateway always uses service_role. Long-term: add `auth_id uuid REFERENCES auth.users(id)` to `users_custom` and rewrite policies on that FK. See RISK-AE-SEC-003.
- **Residual:** RISK-AE-SEC-003 (LOW — cross-UUID-space residual; deferred to first `users_custom` migration). Production apply remains ARB-gated.
- **Do NOT:** add a route over `theme_purchases` in production until migration 191 is applied (ARB approval required).

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
- **Phase AB note:** Phase AB did not touch `theme_instances` or the `publish_theme_release` SECURITY DEFINER RPC. The plan-limit non-atomic count-then-insert gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch `theme_instances` or the `publish_theme_release` SECURITY DEFINER RPC. The gap remains. Retarget: Phase AD.
- **Target:** Phase AD or an ARB-gated follow-up whichever first touches the `theme_instances` schema or `publish_theme_release` SECURITY DEFINER surface.

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

## Phase X risks

### RISK-X01 — R2 storage key path is user-scoped, not site-scoped — [LOW]
- **Status:** OPEN · known residual; deferred.
- **Introduced:** Phase X (2026-07-11).
- **Evidence:** `services/api-gateway/src/routes/upload.ts` — storage key: `${folder}/${auth.user.id}/${Date.now()}-${uuid}.${ext}`. The `folder` is `<storeId>/products` (set by the merchant proxy), but the key component directly after `folder` is `auth.user.id`, not `site_id`. Two stores owned by the same `user.id` would share the user-id segment in their R2 key paths. Cross-store read isolation relies exclusively on `verifySiteOwnership` at the API layer — an actor cannot request another store's CDN URL through the gateway, but if a CDN URL were somehow shared out-of-band, the R2 bucket's key structure would not provide an additional isolation boundary.
- **Why it matters:** True defence-in-depth key isolation would use `${siteId}/${userId}/...` so that even if the API layer failed, R2 bucket policies could scope by site prefix. The current structure requires the API-level `verifySiteOwnership` as the sole isolation boundary, which is correct and tested (X-T04) but is a single-layer defence.
- **Disposition:** Fix: update the key format to `${folder}/${siteId}/${auth.user.id}/${timestamp}-${uuid}.${ext}` where `siteId` is the verified store's UUID (already available in the upload handler after `verifyUploadStoreOwnership`). This is a non-breaking change if applied going forward; existing CDN URLs remain valid (the CDN serves whatever key was used at upload time). A future migration would be required to rename existing keys for full parity. **Target:** first security migration or Phase Z if touching `upload.ts`.
- **Phase Y note:** Phase Y did not touch `upload.ts`. The gap remains.
- **Phase Z note:** Phase Z did not touch `upload.ts`. The gap remains.
- **Phase AA note:** Phase AA did not touch `upload.ts`. Gap remains.
- **Phase AB note:** Phase AB did not touch `upload.ts`. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch `upload.ts`. Gap remains. Retarget: Phase AD.
- **Current isolation:** API-level `verifySiteOwnership` is tested (X-T04), enforced consistently, and provides the correct boundary for all current attack scenarios.

### RISK-T01 — Pre-Zod stack-depth attack via `z.lazy()` recursion — [MEDIUM]
- **Status:** OPEN · known residual; deferred.
- **Introduced:** Phase T (2026-07-11).
- **Evidence:** `packages/theme-engine/src/theme-bundle.ts:1420` — `parseLiquidThemePackageBundle` calls `LiquidThemePackageBundleSchema.parse(input)` directly without a pre-Zod structural depth check. `ThemeBundleTemplateBlockSchema` is self-recursive via `z.lazy()`. A crafted bundle JSON with extreme nesting depth (e.g., 100 levels, achievable within the request body size before Cloudflare's generic limits apply) would overflow the V8 call stack during Zod's `_parse` recursion before the `superRefine` depth check fires, producing a `RangeError: Maximum call stack size exceeded`. `parseThemeDocument` has the same gap: `assertNoBlockedKeysInRaw` (which runs pre-Zod) checks key blocklist at depth-128 but does not limit structural depth.
- **Why it matters:** An authenticated merchant (or a crafted bundle file in an upload flow) could trigger a Worker crash via a deep-nesting attack. Cloudflare Worker per-request CPU limits and memory limits provide some containment, but a RangeError is less clean than a 400 ZodError and may interfere with error handling pipelines.
- **Disposition:** Full closure requires adding a fast iterative pre-Zod structural depth check to `parseLiquidThemePackageBundle` (after `assertNoBlockedKeysInRaw`-style call) and optionally to `parseThemeDocument`. Additionally, adding an explicit `bodyLimit` middleware to the theme package upload route reduces blast radius. Deferred from Phase T to avoid touching production parse paths without dedicated test coverage for the pre-check logic in the bundle context.
- **Phase X note:** Phase X did not touch `theme-bundle.ts` or `parseLiquidThemePackageBundle`. The gap remains.
- **Phase Y note:** Phase Y did not touch `theme-bundle.ts` or `parseLiquidThemePackageBundle`. The gap remains.
- **Phase Z note:** Phase Z did not touch `theme-bundle.ts` or `parseLiquidThemePackageBundle`. The gap remains.
- **Phase AA note:** Phase AA did not touch `theme-bundle.ts` or `parseLiquidThemePackageBundle`. Gap remains.
- **Phase AB note:** Phase AB did not touch `parseLiquidThemePackageBundle`. The merge engine (`theme-safe-update.ts`) calls `parseThemeDocument` (not the bundle parser), so RISK-T01 remains open. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch `parseLiquidThemePackageBundle`. The intent parser (`ai-intent-parser.ts`) calls `parseThemeDocument` on its output (not the bundle parser). Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or earliest phase touching `parseLiquidThemePackageBundle` or the upload route.

### RISK-T02 — No `assertNoBlockedKeysInRaw` in `parseLiquidThemePackageBundle` — [MEDIUM]
- **Status:** OPEN · known residual; deferred.
- **Introduced:** Phase T (2026-07-11).
- **Evidence:** `packages/theme-engine/src/theme-document.ts:493` calls `assertNoBlockedKeysInRaw(input)` before `ThemeDocumentSchema.parse(input)`. `packages/theme-engine/src/theme-bundle.ts:1420` (`parseLiquidThemePackageBundle`) does NOT call `assertNoBlockedKeysInRaw`. Phase T introduced nested block settings (`ThemeBundleTemplateBlockSchema.blocks[id].settings`) parsed via `z.record(z.string(), ThemeBundleJsonSchema)`. A key `"__proto__"` in block settings will invoke the prototype setter on the parsed output object, silently changing its `[[Prototype]]`. The downstream `filterBlockedSettingsKeys` in the renderer never sees `__proto__` via `Object.keys` because V8 does not return it from `Object.keys` after a prototype mutation.
- **Why it matters:** An attacker-supplied `block.settings.__proto__` value could expose attacker-controlled inherited properties via `{{ block.settings.admin }}` in a Liquid template. Impact is bounded to the merchant's own storefront; no cross-tenant blast radius.
- **Disposition:** Fix: call `assertNoBlockedKeysInRaw` (already exported from `theme-document.ts`) at the top of `parseLiquidThemePackageBundle`. One-line call site change; no schema-level side effects. Deferred from Phase T to avoid touching the production parse path without dedicated bundle-context test coverage.
- **Phase X note:** Phase X did not touch `parseLiquidThemePackageBundle`. The gap remains.
- **Phase Y note:** Phase Y did not touch `parseLiquidThemePackageBundle`. The gap remains.
- **Phase Z note:** Phase Z did not touch `parseLiquidThemePackageBundle`. The gap remains.
- **Phase AA note:** Phase AA did not touch `parseLiquidThemePackageBundle`. Gap remains.
- **Phase AB note:** Phase AB did not touch `parseLiquidThemePackageBundle`. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch `parseLiquidThemePackageBundle`. Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or earliest phase touching `parseLiquidThemePackageBundle`.

### RISK-T03 — Block settings bypass `filterBlockedSettingsKeys` in the renderer — [LOW]
- **Status:** PARTIALLY CLOSED (Phase Y, 2026-07-11) · app-block path now protected; non-app block path still open.
- **Introduced:** Phase T (2026-07-11). Pre-existing for flat blocks; Phase T's `sub_blocks` threading adds a second unfiltered position.
- **Evidence:** `packages/theme-engine/src/theme-renderer.ts:818` — `settings: block.settings` and `theme-renderer.ts:824` — `settings: child.settings` (in `sub_blocks[]`) are inserted raw into the Liquid scope without calling `filterBlockedSettingsKeys`. The `BLOCKED_DROP_KEYS` set (which excludes `api_key`, `webhook_secret`, etc.) is applied only to the global `settings` drop (line 883), not to block-level settings.
- **Why it matters:** Credential-named keys in merchant-authored `block.settings` are accessible via `{{ block.settings.api_key }}` without the blocked-key guard. All rendered HTML passes through DOMPurify but non-HTML-encoded plain strings are not stripped.
- **Phase Y resolution (partial):** Phase Y introduced `filterAppBlockSettings` (in `app-block-model.ts`) and applies it at the `isLiquidAppBlockType` branch in `renderLiquidSectionBlocks`. App-block settings (blocks of type `'@app'` or `'app:*'`) are now filtered before entering `LiquidRenderedBlock.settings` and the section-level Liquid drop. The `BLOCKED_APP_BLOCK_SETTING_KEYS` set (13 keys) mirrors `BLOCKED_DROP_KEYS`; parity asserted by test Y-13.
- **Remaining gap (non-app blocks):** `settings: block.settings` at line 818 and `settings: child.settings` at line 824 (non-app blocks and nested blocks) still bypass `filterBlockedSettingsKeys`. These lines are in the normal block render path (not the `isLiquidAppBlockType` branch) and were not modified in Phase Y.
- **Disposition:** Fix remaining gap: apply `filterBlockedSettingsKeys` to `block.settings` and `child.settings` at their Liquid scope insertion points (lines 818, 824). This is defence-in-depth; no legitimate merchant theme uses credential-adjacent key names in non-app block settings.
- **Phase AA note:** Phase AA touched `theme-renderer.ts` for the head-assets path only (import of `validateAndScopeCustomCss` at line 33 + `buildLiquidThemeHeadAssets` body at lines 306–326). Lines 818/824 (block-level settings render path) were not modified. Gap remains. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not touch `theme-renderer.ts` lines 818/824 (block settings render path). The merge engine writes to the per-store ThemeDocument before publish; it does not touch the renderer's block-level Liquid scope path. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch `theme-renderer.ts` lines 818/824. The intent parser operates on ThemeDocument structure, not on the renderer block-level scope path. Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or first phase touching `theme-renderer.ts` lines 818/824.

### RISK-T04 — `RENDERER_MAX_BLOCK_DEPTH` is private/unexported — depth parity test cannot directly assert it — [LOW]
- **Status:** OPEN · test quality gap; deferred past Phase U.
- **Introduced:** Phase T (2026-07-11).
- **Evidence:** `RENDERER_MAX_BLOCK_DEPTH = 3` is a private module-local constant in `theme-renderer.ts:950`. The test `nested-blocks: (f) RENDERER_MAX_BLOCK_DEPTH === MAX_BLOCK_NESTING_DEPTH` asserts `MAX_BLOCK_NESTING_DEPTH === 3` and `MAX_BUNDLE_BLOCK_NESTING_DEPTH === 3` but cannot directly assert the renderer constant. If the renderer constant were changed to 2, the test would still pass.
- **Disposition:** Fix: export `RENDERER_MAX_BLOCK_DEPTH` from `theme-renderer.ts` and add a direct equality assertion. Alternatively, add a behavioral test that renders a depth-3 fixture and verifies all three levels produce non-empty `sub_blocks`.
- **Phase U note:** Phase U did not touch `theme-renderer.ts`.
- **Phase V note:** Phase V did not touch `theme-renderer.ts`.
- **Phase X note:** Phase X did not touch `theme-renderer.ts`. The gap remains.
- **Phase Y note:** Phase Y touched `theme-renderer.ts` (2 hunks: import + `isLiquidAppBlockType` branch). `RENDERER_MAX_BLOCK_DEPTH` (a private const, not near the touched hunks) was not exported. The test quality gap remains.
- **Phase Z note:** Phase Z did not touch `theme-renderer.ts`. The test quality gap remains.
- **Phase AA note:** Phase AA touched `theme-renderer.ts` (import line + `buildLiquidThemeHeadAssets` body). `RENDERER_MAX_BLOCK_DEPTH` is a private const unrelated to the touched hunks and was not exported. Gap remains. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not export `RENDERER_MAX_BLOCK_DEPTH` from `theme-renderer.ts`. The merge engine operates on ThemeDocument structure, not on the renderer constant. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not export `RENDERER_MAX_BLOCK_DEPTH` from `theme-renderer.ts`. The intent parser operates on ThemeDocument structure. Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or first phase touching `theme-renderer.ts`.

### RISK-T05 — `allowedChildTypes` not passed from `SectionTreePanel` to `BlockChildRow` — add-child button dead — [MEDIUM]
- **Status:** OPEN · functional gap; deferred past Phase U.
- **Introduced:** Phase T (2026-07-11).
- **Evidence:** `apps/merchant-control-plane/src/components/theme-editor/SectionTreePanel.tsx:267–279` — the `BlockChildRow` call at depth-1 does not pass `allowedChildTypes`. `BlockChildRow.tsx:143–146` computes `canAddChildren = depth < MAX_EDITOR_BLOCK_DEPTH && Array.isArray(allowedChildTypes) && allowedChildTypes.length > 0`. Since `allowedChildTypes` is always `undefined` at depth-1, `canAddChildren` is always `false` and the add-child button never renders.
- **Why it matters:** The Phase T add-child affordance is non-functional for all merchants. The three child callbacks (`onAddChildBlock`, `onRemoveChildBlock`, `onMoveChildBlock`) are wired but the add-child entry point is dead.
- **Disposition:** Fix: at the `BlockChildRow` call site in `SectionTreePanel.tsx`, resolve `allowedChildTypes` from `schema?.blocks_schema?.[block.type]?.allowed_child_types ?? undefined`. The `schema` and `blocks_schema` lookup are already used at that call site for `blockLabel` resolution — the fix is a one-prop addition.
- **Phase U note:** Phase U did not touch `SectionTreePanel.tsx`. The gap remains.
- **Phase V note:** Phase V did not touch `SectionTreePanel.tsx` (TemplateSwitcherPanel is a new standalone file, not a SectionTreePanel modification).
- **Phase X note:** Phase X did not touch `SectionTreePanel.tsx`. The gap remains.
- **Phase Y note:** Phase Y did not touch `SectionTreePanel.tsx`. The gap remains.
- **Phase Z note:** Phase Z did not touch `SectionTreePanel.tsx`. The gap remains.
- **Phase AA note:** Phase AA did not touch `SectionTreePanel.tsx`. Gap remains. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not touch `SectionTreePanel.tsx`. The ThemeUpdatePanel is a standalone component (`ThemeUpdatePanel.tsx`) separate from the section tree. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch `SectionTreePanel.tsx`. `AICustomizationPanel.tsx` is a standalone component separate from the section tree. Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or first phase touching `SectionTreePanel.tsx`.

### RISK-T06 — `UnsupportedThemeDocumentFeatureError` exported but never thrown — [LOW]
- **Status:** OPEN · dead API; deferred past Phase U.
- **Introduced:** Phase N (2026-07-10). Became dead in Phase T (2026-07-11).
- **Evidence:** `packages/theme-engine/src/theme-document.ts:89–97` — `UnsupportedThemeDocumentFeatureError` is defined and exported. It was previously thrown by the Phase N fail-closed guard in `fromThemeDocumentV2` (lines 560–573, pre-Phase-T). That guard was removed in Phase T. A `grep` across all app and service source confirms no external catch sites for this class; it is dead public API.
- **Disposition:** Either re-purpose with updated JSDoc ("reserved for future phase-gated feature flags") or remove the class and its export entirely. Removal is safe since no catch sites exist.
- **Phase U note:** Phase U did not touch `theme-document.ts`.
- **Phase V note:** Phase V touched `theme-document.ts` to add the template-key `superRefine` and variant-cap enforcement, but did not remove or re-purpose `UnsupportedThemeDocumentFeatureError`. The class remains dead.
- **Phase X note:** Phase X did not touch `theme-document.ts`. The class remains dead.
- **Phase Y note:** Phase Y did not touch `theme-document.ts`. The class remains dead.
- **Phase Z note:** Phase Z did not touch `theme-document.ts`. The class remains dead.
- **Phase AA note:** Phase AA did not touch `theme-document.ts`. Class remains dead. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not touch `theme-document.ts`. Class remains dead. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch `theme-document.ts`. `ai-intent-parser.ts` calls `parseThemeDocument` (a consumer, not a modification). Class remains dead. Retarget: Phase AD.
- **Target:** Phase AD or next `theme-document.ts` touch.

## Phase U risks

### RISK-SEC-U01 — `isUnsafeUrl` blocklist is too narrow — missing `data:image/svg+xml`, `data:text/javascript`, `blob:` — [MEDIUM]
- **Status:** OPEN · known residual; deferred.
- **Introduced:** Phase U (2026-07-11).
- **Evidence:** `packages/theme-engine/src/schema-field-extensions.ts` — `isUnsafeUrl` checks only 4 patterns: `javascript:`, `vbscript:`, `data:text/html`, `data:application/xhtml`. These are identical to the private `isUnsafeThemeUrl` they re-implement. A `data:image/svg+xml` URL containing an embedded `<script>` tag executes JavaScript when used as an `<img src>` or `<iframe src>` attribute. A `data:text/javascript,alert(1)` URL is executable when used as `<a href>`. A `blob:` URL wrapping a JavaScript blob has the same property.
- **Why it matters:** `UrlInput` and `VideoControl` use `isUnsafeUrl` as their only protocol guard. `VideoUrlControl` has an additional YouTube/Vimeo HTTPS domain pattern that covers the practical attack surface there. The gap is most material for `url` and `video` fields where the merchant can enter arbitrary URLs.
- **Disposition:** Widen the blocklist in `isUnsafeUrl`: add `normalized.startsWith('data:image/svg+xml')`, `normalized.startsWith('data:text/javascript')`, `normalized.startsWith('blob:')`. Consider a broader allowlist approach: default-block all `data:` URIs except `data:image/png`, `data:image/jpeg`, `data:image/gif`, `data:image/webp`. Update the private `isUnsafeThemeUrl` in `index.ts` identically to keep both in sync.
- **Phase V note:** Phase V did not touch `schema-field-extensions.ts`.
- **Phase X note:** Phase X did not widen the blocklist. However, Phase X added `isUnsafeUrl(url)` guards to `ImagePickerControl.handleLibrarySelect` and `VideoControl.handleLibrarySelect` (defence-in-depth improvement — library-selected URLs now pass through the same guard as manually-typed URLs). The underlying gap (narrow blocklist) remains.
- **Phase Y note:** Phase Y did not touch `schema-field-extensions.ts`. The gap remains.
- **Phase Z note:** Phase Z did not touch `schema-field-extensions.ts`. The gap remains.
- **Phase AA note:** Phase AA did not touch `schema-field-extensions.ts`. Gap remains. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not touch `schema-field-extensions.ts`. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch `schema-field-extensions.ts`. `ai-intent-parser.ts` imports `isUnsafeUrl` as a consumer but does not modify the blocklist. Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or first `schema-field-extensions.ts` touch.

### RISK-SEC-U02 — `ColorBackgroundControl` gradient mode accepts arbitrary CSS content including `url()` — [MEDIUM]
- **Status:** OPEN · editor-side gap; render-time concern.
- **Introduced:** Phase U (2026-07-11).
- **Evidence:** `apps/merchant-control-plane/src/components/theme-editor/controls/ColorBackgroundControl.tsx` — in gradient mode, the `<Input type="text">` accepts any CSS string without validation. `validateFieldValue` for `color_background` has no type-specific CSS content check (falls through to `break`). A gradient string like `linear-gradient(to right, url(javascript:alert(1)), red)` passes the editor without rejection.
- **Why it matters:** The storefront renderer applies the `color_background` value as a CSS `background` property. If the frozen renderer does not sanitise `url()` expressions inside gradient strings, a CSS-injection attack path exists at render time. The editor itself does not apply the value as CSS, so no XSS in the editor. The risk is at render time in the storefront.
- **Disposition:** Add a gradient-mode validation rule in `validateFieldValue` for `color_background`: reject values containing `url(` or `expression(` (case-insensitive regex: `/url\s*\(/i`). This should live in `schema-field-extensions.ts` and mirror whatever the storefront renderer strips.
- **Phase V note:** Phase V did not touch `schema-field-extensions.ts` or `ColorBackgroundControl.tsx`.
- **Phase X note:** Phase X did not touch `schema-field-extensions.ts` or `ColorBackgroundControl.tsx`. The gap remains.
- **Phase Y note:** Phase Y did not touch `schema-field-extensions.ts` or `ColorBackgroundControl.tsx`. The gap remains.
- **Phase Z note:** Phase Z did not touch `schema-field-extensions.ts` or `ColorBackgroundControl.tsx`. The gap remains.
- **Phase AA note:** Phase AA did not touch `schema-field-extensions.ts` or `ColorBackgroundControl.tsx`. Gap remains. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not touch `schema-field-extensions.ts` or `ColorBackgroundControl.tsx`. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch `schema-field-extensions.ts` or `ColorBackgroundControl.tsx`. Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or first `schema-field-extensions.ts` touch.

### RISK-SEC-U03 — `required: true` on `checkbox` / `toggle` is a validation no-op — [MEDIUM]
- **Status:** OPEN · API design gap.
- **Introduced:** Phase U (2026-07-11).
- **Evidence:** `packages/theme-engine/src/schema-field-extensions.ts:validateFieldValue` — the required check rejects `null | undefined | ''`. `resolveFieldDefault` returns `false` for `checkbox` and `toggle`. `SchemaFormRenderer` passes `Boolean(value)` to boolean controls. A field with no stored value resolves to `false`, which passes the required check. A required checkbox never produces a validation error regardless of whether the merchant checked it.
- **Why it matters:** Theme schema authors who mark a checkbox `required` expect validation feedback when the merchant leaves it unchecked. The current behaviour silently ignores the requirement.
- **Disposition:** Options: (1) add a type-specific required guard for `checkbox`/`toggle`: `if (field.required && (type === 'checkbox' || type === 'toggle') && value === false) → error`. (2) Document `required` as inapplicable to boolean controls and omit `required` from `ToggleInput` / `CheckboxControl` rendering. (3) Introduce a separate property `must_be_checked?: boolean` for boolean consent fields.
- **Phase V note:** Phase V did not touch `schema-field-extensions.ts`.
- **Phase X note:** Phase X did not touch `schema-field-extensions.ts`. The gap remains.
- **Phase Y note:** Phase Y did not touch `schema-field-extensions.ts`. The gap remains.
- **Phase Z note:** Phase Z did not touch `schema-field-extensions.ts`. The gap remains.
- **Phase AA note:** Phase AA did not touch `schema-field-extensions.ts`. Gap remains. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not touch `schema-field-extensions.ts`. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch `schema-field-extensions.ts`. Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or first `schema-field-extensions.ts` touch.

## Phase U accessibility risks

### RISK-A11Y-U01 — `TextInput` and `TextareaInput` missing `aria-describedby` linkage to error element — [MEDIUM]
- **Status:** OPEN · a11y gap in pre-Phase-U controls; not fixed in Phase U or Phase V.
- **Introduced:** Pre-Phase-U baseline; confirmed in Phase U review (2026-07-11).
- **Evidence:** `apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx` — `TextInput` (line ~344) sets `aria-invalid={error ? 'true' : undefined}` on the `<Input>` element but does not set `aria-describedby` pointing to the `<FieldError id="${id}-error">` element. `TextareaInput` (line ~379) has the same pattern. Screen readers will announce the field as invalid but will not read the error message when the user focuses the field — the announcement depends on the element being inside the `<label>`, which is browser- and screen-reader-dependent.
- **Why it matters:** All Phase U new controls (CheckboxControl, FontPickerControl, etc.) correctly link `aria-describedby`; this pre-existing gap in the two most common field types (`text`, `textarea`) leaves the baseline controls inconsistent with the Phase U controls.
- **Disposition:** Add `aria-describedby={error ? `${id}-error` : helpText ? `${id}-help` : undefined}` to the `<Input>` inside `TextInput` and to the `<textarea>` inside `TextareaInput`, mirroring the pattern used by `NumberInput` and all Phase U controls.
- **Phase V note:** Phase V did not touch `SchemaFormRenderer.tsx`.
- **Phase X note:** Phase X touched `SchemaFormRenderer.tsx` (4-line `case 'image':` patch only). `TextInput` and `TextareaInput` were not changed; the gap remains.
- **Phase Y note:** Phase Y did not touch `SchemaFormRenderer.tsx`. The gap remains.
- **Phase Z note:** Phase Z did not touch `SchemaFormRenderer.tsx`. The gap remains.
- **Phase AA note:** Phase AA did not touch `SchemaFormRenderer.tsx`. Gap remains. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not touch `SchemaFormRenderer.tsx`. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch `SchemaFormRenderer.tsx`. Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or first `SchemaFormRenderer.tsx` touch.

### RISK-A11Y-U02 — `CheckboxControl`, `FontPickerControl`, `ColorSchemeControl` use ternary `aria-describedby` — drops `helpText` when error present — [LOW]
- **Status:** OPEN · a11y inconsistency; deferred past Phase V.
- **Introduced:** Phase U (2026-07-11).
- **Evidence:** `aria-describedby={error ? `${id}-error` : helpText ? `${id}-help` : undefined}` in `CheckboxControl.tsx`, `FontPickerControl.tsx`, `ColorSchemeControl.tsx`. When both an error and `helpText` are present, only the error id is linked; the `helpText` span is rendered in the DOM but not programmatically associated. `HtmlControl`, `LiquidControl`, `VideoUrlControl`, and `ResourcePickerControl` correctly use the array-filter-join pattern: `[error ? `${id}-error` : null, helpText ? `${id}-help` : null].filter(Boolean).join(' ') || undefined`.
- **Disposition:** Replace the ternary with the array-join pattern in the three affected controls.
- **Phase V note:** Phase V did not touch any Phase U control files.
- **Phase X note:** Phase X touched `controls/` (VideoControl.tsx additive patch + controls.module.css new classes). `CheckboxControl.tsx`, `FontPickerControl.tsx`, and `ColorSchemeControl.tsx` were not changed; the gap remains.
- **Phase Y note:** Phase Y added `AppBlockSlotPanel.tsx` and modified `controls.module.css` (additive). `CheckboxControl.tsx`, `FontPickerControl.tsx`, and `ColorSchemeControl.tsx` were not changed; the gap remains.
- **Phase Z note:** Phase Z did not touch `CheckboxControl.tsx`, `FontPickerControl.tsx`, or `ColorSchemeControl.tsx`. The gap remains.
- **Phase AA note:** Phase AA did not touch `CheckboxControl.tsx`, `FontPickerControl.tsx`, or `ColorSchemeControl.tsx`. Gap remains. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not touch `CheckboxControl.tsx`, `FontPickerControl.tsx`, or `ColorSchemeControl.tsx`. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch `CheckboxControl.tsx`, `FontPickerControl.tsx`, or `ColorSchemeControl.tsx`. Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or first `CheckboxControl.tsx`/`FontPickerControl.tsx`/`ColorSchemeControl.tsx` touch.

## Phase U style risks

### RISK-STYLE-U01 — `LiquidControl.tsx` uses raw `fontSize: 12` inline style — [LOW]
- **Status:** OPEN · design token violation; deferred.
- **Introduced:** Phase U (2026-07-11).
- **Evidence:** `apps/merchant-control-plane/src/components/theme-editor/controls/LiquidControl.tsx:68` — `style={{ fontFamily: '"Fira Code", "Consolas", monospace', fontSize: 12 }}`. React resolves `fontSize: 12` to `12px` — a raw pixel value. The `--lb-*` tokens mandate `var(--lb-font-size-caption, 12px)` for this size range.
- **Disposition:** Change `fontSize: 12` to `fontSize: 'var(--lb-font-size-caption, 12px)'`.
- **Phase V note:** Phase V did not touch `LiquidControl.tsx`.
- **Phase X note:** Phase X touched `controls/` but did not touch `LiquidControl.tsx`. The gap remains.
- **Phase Y note:** Phase Y did not touch `LiquidControl.tsx`. The gap remains.
- **Phase Z note:** Phase Z did not touch `LiquidControl.tsx`. The gap remains.
- **Phase AA note:** Phase AA did not touch `LiquidControl.tsx`. Gap remains. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not touch `LiquidControl.tsx`. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch `LiquidControl.tsx`. Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or first `LiquidControl.tsx` touch.

### RISK-STYLE-U02 — `controls.module.css` uses raw `px` spacing values — [LOW]
- **Status:** OPEN · design token inconsistency; deferred.
- **Introduced:** Phase U (2026-07-11).
- **Evidence:** `apps/merchant-control-plane/src/components/theme-editor/controls/controls.module.css` — several rules use raw `px` spacing (`gap: 4px`, `padding: 3px 8px`, `margin-top: 4px`). The design ratchet tests check for `rounded-[Npx]` patterns and `--lb-` token presence; these raw values pass the gate but are inconsistent with the stated `--lb-*` tokens-only rule.
- **Disposition:** Replace literal spacing values with `--lb-*` spacing tokens where they exist (e.g., `var(--lb-space-1)` for 4px, `var(--lb-space-2)` for 8px). Where tokens are absent, document the gap and add the tokens to the design system.
- **Phase V note:** Phase V did not touch `controls.module.css`.
- **Phase X note:** Phase X added new `mediaLibrary*` and `browseLibraryBtn` classes to `controls.module.css`, all using `--lb-*` tokens. Pre-existing raw `px` spacing values (gap: 4px, padding: 3px 8px, margin-top: 4px) in Phase U classes were not changed. The gap for pre-existing classes remains.
- **Phase Y note:** Phase Y added 9 new `appBlock*` classes to `controls.module.css`, all using `--lb-*` tokens. Pre-existing raw `px` spacing values in Phase U classes were not changed. The gap remains.
- **Phase Z note:** Phase Z introduced a separate `theme-locale.module.css` file (all `--lb-*` tokens). Phase Z did not touch `controls.module.css`. The gap in pre-Phase-X `controls.module.css` classes remains.
- **Phase AA note:** Phase AA added `theme-editor-aa.test.mjs` to `package.json` (additive) but did not touch `controls.module.css` pre-Phase-X classes. Pre-existing raw `px` spacing in Phase U classes unchanged. Gap remains. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not touch `controls.module.css`. Pre-existing raw `px` spacing in Phase U classes unchanged. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch `controls.module.css`. Pre-existing raw `px` spacing in Phase U classes unchanged. Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or a dedicated token-cleanup pass over pre-Phase-X `controls.module.css` entries.

## Phase N risks

### RISK-DUAL-N01 — `section_definitions` / `block_definitions` dual-truth risk in Phase R-S editor — [MEDIUM]
- **Status:** OPEN · mechanically guarded in Phase R; must be preserved in Phase S+.
- **Introduced:** Phase N (2026-07-10). Partially mitigated Phase R (2026-07-10).
- **Evidence:** `ThemeDocumentSchema` embeds `section_definitions` (= bundle's `sections` Liquid source files) and `block_definitions` (= bundle's `blocks` Liquid source files). If the Phase R-S editor mutates these fields when saving a draft, the embedded Liquid source would diverge from the canonical theme package version in the DB. Phase N marks these fields READ-ONLY in code comments (`packages/theme-engine/src/theme-document.ts` lines 285–297) but does not mechanically prevent editor mutation.
- **Why it matters:** A divergent `section_definitions` would mean `fromThemeDocumentV2` produces a bundle with different Liquid source than what the theme package was published with — silently different rendering behaviour for the same theme version.
- **Mechanical backstop:** `fromThemeDocumentV2` calls `parseLiquidThemePackageBundle(raw)` as its last step. If `section_definitions` has been mutated so that template section types no longer match, the `superRefine` on the bundle will reject the document before it reaches persistence.
- **Phase R mitigation:** `buildDraftConfig(baseConfig, themeId, editorState, selectedTemplateKey)` in `page.tsx` always merges the mutable `editorState` (template/settings) over `baseConfig`. The immutable `section_definitions` and `block_definitions` come from `baseConfig` (loaded from the API at editor open), never from `editorState`. No Phase R code path writes these fields from editor state. The `EDITOR_GUIDE.md` section "8.5 baseConfig and RISK-DUAL-N01" documents this constraint explicitly.
- **Phase S mitigation (inspector):** `INSPECTOR_ADD_SECTION_INTENT` carries only `{ adjacentSectionId, position }` — no section object, no Liquid source, no template mutation. `EditorPreviewSectionFrame.sendAddIntent()` has no access to `template.sections`. Contract test "section frame never mutates template sections" asserts `sections.push / splice / filter` are absent from the file. The editor (`CenterPanel.handleMessage` → `onAddSectionIntent?.(...)`) receives the intent and is responsible for any section mutation through the normal `applyChange()` + `buildDraftConfig()` path.
- **Phase V mitigation (TemplateSwitcherPanel):** `TemplateSwitcherPanel.onChange` emits only a template key string. `onCreateAlternate` emits only a base-type string (intent signal). The component has no access to `section_definitions` or `block_definitions` and no mechanism to mutate them. Contract test "file does not reference section_definitions" asserts this at the static-analysis level.
- **Disposition:** Mechanically enforced through Phase V. Phase W and all subsequent editor phases MUST NOT add a mutation path for `section_definitions` or `block_definitions`. Any future feature that needs to update Liquid source must go through the theme package publish pipeline, not the draft save path.
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

## Phase W risks

### RISK-W01 — `BINDING_BLOCKED_KEYS` is a manually-maintained copy of `BLOCKED_DROP_KEYS` — no parity enforcement — [MEDIUM]
- **Status:** OPEN · known residual; deferred.
- **Introduced:** Phase W (2026-07-11).
- **Evidence:** `packages/theme-engine/src/dynamic-source-binding.ts` — `BINDING_BLOCKED_KEYS` is a hand-maintained set of 14 credential-adjacent key names. `BLOCKED_DROP_KEYS` in `packages/theme-engine/src/theme-renderer.ts` has the same 14 keys. Both sets are currently identical. No compile-time import relationship enforces this parity. If `BLOCKED_DROP_KEYS` gains a new key name in a future patch (e.g., `session_token`, `bearer_token`) and `BINDING_BLOCKED_KEYS` is not updated simultaneously, resolved resource drops containing that key would pass `filterDropKeys` in `resolveDynamicSourceDescriptors` and reach Liquid scope via a `ResourceBinding` descriptor — even though the same key is blocked on plain settings by the renderer's own `filterBlockedSettingsKeys`.
- **Why it matters:** The two blocklists must stay in sync to prevent a credential-adjacent key from becoming accessible via the resource-binding code path after being blocked on the direct-settings path.
- **Disposition:** Export `BLOCKED_DROP_KEYS` from `theme-renderer.ts` (it is already `export const`) and import it into `dynamic-source-binding.ts` as the single source of truth, removing the duplicated set. Alternatively, add a unit test that imports both sets and asserts strict set equality — so any future `BLOCKED_DROP_KEYS` addition that is not mirrored fails the test gate immediately.
- **Phase X note:** Phase X did not touch `dynamic-source-binding.ts` or `theme-renderer.ts`. The gap remains.
- **Phase Y note:** Phase Y touched `theme-renderer.ts` (2 hunks — `isLiquidAppBlockType` branch only). The BINDING_BLOCKED_KEYS / BLOCKED_DROP_KEYS parity gap is in `dynamic-source-binding.ts`, which was not touched. The gap remains.
- **Phase Z note:** Phase Z did not touch `dynamic-source-binding.ts` or `theme-renderer.ts`. The gap remains.
- **Phase AA note:** Phase AA touched `theme-renderer.ts` (import + `buildLiquidThemeHeadAssets`) but did NOT export `BLOCKED_DROP_KEYS` or touch `dynamic-source-binding.ts`. The BINDING_BLOCKED_KEYS / BLOCKED_DROP_KEYS parity gap remains. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not export `BLOCKED_DROP_KEYS` from `theme-renderer.ts` and did not touch `dynamic-source-binding.ts`. The merge engine does not interact with the blocked-keys path. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not export `BLOCKED_DROP_KEYS` from `theme-renderer.ts` and did not touch `dynamic-source-binding.ts`. The intent parser does not interact with the blocked-keys path. Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or earliest phase touching `dynamic-source-binding.ts` or `theme-renderer.ts`.

### RISK-W02 — `auth.user.storeId` optional in ES256 tokens — session-bound fast-fail in `verifySiteOwnership` bypassed when absent — [LOW]
- **Status:** OPEN · known residual; deferred.
- **Introduced:** Phase W (2026-07-11).
- **Evidence:** `services/api-gateway/src/lib/auth-user.ts` — `storeId?: string` (optional). The fast-fail inside `verifySiteOwnership` (`if (sessionStoreId && sessionStoreId !== siteId) return false`) is vacuously bypassed when `storeId` is absent from the token — pre-date tokens or internal-SSO flows where the store header is not supplied. The DB ownership check still enforces tenant isolation; no cross-tenant read is possible. However, the stronger of the two controls disappears silently for these token shapes.
- **Why it matters:** The fast-fail prevents even a DB round-trip for cross-tenant access attempts from merchants with well-formed session tokens. Its absence for legacy/internal tokens degrades defence-in-depth without breaking correctness.
- **Disposition:** Add a test case in `resource-search-w.test.ts` proving the route still 403s when `auth.user.storeId` is undefined and the actor does not own the store (DB check still enforced). Long-term: require `storeId` in all ES256 merchant tokens at issuance to make the fast-fail unconditional.
- **Phase X note:** Phase X's media-library route has the same optional-storeId exposure (same `verifySiteOwnership` call pattern). The gap applies to the new route equally. Phase X did not touch the token issuance path.
- **Phase Y note:** Phase Y did not touch `resource-search.ts`, `media-library.ts`, or the token issuance path. The gap remains.
- **Phase Z note:** Phase Z did not touch `resource-search.ts`, `media-library.ts`, or the token issuance path. The gap remains.
- **Phase AA note:** Phase AA did not touch `resource-search.ts`, `media-library.ts`, or the token issuance path. Gap remains. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not touch `resource-search.ts`, `media-library.ts`, or the token issuance path. The Phase AB update-preview and update routes follow the same `resolveCustomUser` + `verifySiteOwnership` pattern (mandatory storeId from body, not from token fast-fail), so the optional-storeId fast-fail gap still exists on the pre-existing routes. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch `resource-search.ts`, `media-library.ts`, or the token issuance path. The `ai-customization/route.ts` proxy uses `resolveOwnedStoreId` (same pattern). Pre-existing route gap remains. Retarget: Phase AD.
- **Target:** Phase AD or earliest phase touching `resource-search.ts`, `media-library.ts`, or the token issuance path.

### RISK-W03 — `siteDrops` tenant-scoping trust boundary is comment-only; block-level bindings unresolved — [LOW]
- **Status:** OPEN · trust boundary documentation gap + functional gap.
- **Introduced:** Phase W (2026-07-11).
- **Evidence:** `packages/theme-engine/src/theme-renderer.ts` line 393 comment: `// siteDrops is already tenant-scoped by the caller`. No assertion, schema check, or integration test validates that the storefront composition layer (which will populate `siteDrops` in a future phase) actually scopes the map to the current site. In Phase W, `siteDrops` defaults to `{}` so no resources can resolve at all, making this latent rather than active. The trust contract is invisible to a future implementer.
- **Why it matters:** A future Phase X implementer building the storefront `siteDrops` hydration could inadvertently pass an unscoped map, allowing a descriptor's `id` from any site to resolve to a drop from another site.
- **Disposition:** Add a mandatory `siteId` field to `SiteDrops` interface so the resolver can log or assert the scope at development time. Document the per-field scoping requirement in `DYNAMIC_SOURCES_REFERENCE.md`. Create an integration test shell for the composition-to-renderer `siteDrops` pipeline before the storefront hydration service is built.
- **Phase X note:** Phase X did not build the storefront `siteDrops` hydration service; `siteDrops` defaults to `{}` in all Phase X render paths. The trust boundary comment-only gap remains. The Phase X media-library route supplies URLs (not resource drops), so it does not feed `siteDrops`.
- **Phase Y note:** Phase Y did not build the storefront `siteDrops` hydration service. The trust boundary comment-only gap remains.
- **Phase Z note:** Phase Z did not build the storefront `siteDrops` hydration service. The trust boundary comment-only gap remains.
- **Phase AA note:** Phase AA did not build the storefront `siteDrops` hydration service. Gap remains. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not build the storefront `siteDrops` hydration service. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not build the storefront `siteDrops` hydration service. Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or the phase that builds the storefront `siteDrops` hydration service.

### RISK-W04 — `ArrowUp` key handler in `ResourcePickerControl` selects item 0 when no item is selected — [LOW]
- **Status:** OPEN · WAI-ARIA 1.2 combobox non-conformance; deferred.
- **Introduced:** Phase W (2026-07-11).
- **Evidence:** `apps/merchant-control-plane/src/components/theme-editor/controls/ResourcePickerControl.tsx` — `ArrowUp` handler: `setActiveIndex((prev) => Math.max(prev - 1, 0))`. When `activeIndex` starts at `-1` (no item selected), `Math.max(-1 - 1, 0) = Math.max(-2, 0) = 0`. The first `ArrowUp` press silently selects item 0 before the user has pressed `ArrowDown`. WAI-ARIA 1.2 combobox pattern expects `ArrowUp` from a no-selection state to either do nothing or focus the last item in the list.
- **Why it matters:** Assistive technology users expect `ArrowDown` to be the initial navigation key into a combobox. The `-1→0` snap on `ArrowUp` is unexpected and may confuse screen reader users.
- **Disposition:** Guard the `ArrowUp` handler: `setActiveIndex((prev) => prev <= 0 ? 0 : prev - 1)` at minimum (clamps without the `-2→0` snap). Alternatively, `ArrowUp` from `-1` → set to `results.length - 1` (focus last item), matching the ARIA pattern for list wrap-around.
- **Phase X note:** Phase X did not touch `ResourcePickerControl.tsx`. The gap remains.
- **Phase Y note:** Phase Y did not touch `ResourcePickerControl.tsx`. The gap remains.
- **Phase Z note:** Phase Z did not touch `ResourcePickerControl.tsx`. The gap remains.
- **Phase AA note:** Phase AA did not touch `ResourcePickerControl.tsx`. Gap remains. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not touch `ResourcePickerControl.tsx`. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch `ResourcePickerControl.tsx`. Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or first `ResourcePickerControl.tsx` touch.

### RISK-W05 — Loading indicator hidden during 300 ms debounce window on first keystroke — [LOW]
- **Status:** OPEN · UX gap; deferred.
- **Introduced:** Phase W (2026-07-11).
- **Evidence:** `apps/merchant-control-plane/src/components/theme-editor/controls/ResourcePickerControl.tsx` — the loading `<li>` spinner is rendered inside `{isOpen ? <ul role="listbox"> … </ul> : null}`. The state transitions to `loading` immediately on each keystroke, but `isOpen` remains `false` until the 300 ms `setTimeout` resolves and results arrive to set `setIsOpen(true)`. On the first keystroke of a fresh session, there is zero visible feedback for the entire debounce window. Subsequent keystrokes (when `isOpen` is already `true` from prior results) do show the spinner.
- **Why it matters:** Merchants who type a single character and pause experience dead silence for 300 ms, then results appear abruptly. This is noticeable on slow connections where the fetch takes additional time after the debounce fires.
- **Disposition:** Set `setIsOpen(true)` immediately when the query becomes non-empty (before the `setTimeout`), so the `{isOpen?…}` conditional is satisfied and the loading `<li>` is visible during the debounce window. The empty-query early-return already calls `setIsOpen(false)`, so the close-on-clear behavior is unaffected.
- **Phase X note:** Phase X did not touch `ResourcePickerControl.tsx`. The gap remains.
- **Phase Y note:** Phase Y did not touch `ResourcePickerControl.tsx`. The gap remains.
- **Phase Z note:** Phase Z did not touch `ResourcePickerControl.tsx`. The gap remains.
- **Phase AA note:** Phase AA did not touch `ResourcePickerControl.tsx`. Gap remains. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not touch `ResourcePickerControl.tsx`. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch `ResourcePickerControl.tsx`. Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or first `ResourcePickerControl.tsx` touch.

### RISK-W06 — Block-level settings not resolved through `resolveDynamicSourceDescriptors` — [LOW]
- **Status:** OPEN · functional gap; CONFIRMED by code review.
- **Introduced:** Phase W (2026-07-11).
- **Evidence:** `packages/theme-engine/src/theme-renderer.ts` — `resolveDynamicSourceDescriptors` is called on section-level `templateSection.settings` (line ~395) but is NOT called on block-level `block.settings` anywhere inside `renderLiquidSectionBlocks` (line ~755). Block settings (`block.settings`) are passed unchanged to `buildLiquidScope` and to the returned `LiquidRenderedBlock.settings`. A `ResourceBinding` descriptor stored as a block setting (rather than a section setting) will reach Liquid as the raw object `{ __lb_binding: true, source: 'resource', resourceType: 'product', id: '...' }` and render as `[object Object]` or an empty string via LiquidJS coercion.
- **Why it matters:** Phase W's primary user-visible value is the resource picker. If a merchant picks a product for a block-level field (e.g., a carousel block with a `featured_product` field), the pick will store correctly in the section's `settings.blocks[id].settings.featured_product`, but the storefront will not resolve it to a drop — the block template will receive the raw descriptor instead.
- **Disposition:** Apply `resolveDynamicSourceDescriptors(block.settings, siteDrops)` at the top of the per-block render loop inside `renderLiquidSectionBlocks`, mirroring the section-level resolution pattern. This is a one-function-call addition at the correct call site; no structural changes required.
- **Related:** See also RISK-T03 (block settings bypass `filterBlockedSettingsKeys`) — fixing RISK-W06 simultaneously provides the defence-in-depth benefit of RISK-T03 for the binding-resolution path.
- **Phase X note:** Phase X did not touch `theme-renderer.ts`. The block-level resolution gap remains.
- **Phase Y note:** Phase Y touched `theme-renderer.ts` (minimal — 2 hunks in the `isLiquidAppBlockType` branch only). The block-level binding resolution path at lines ~755+ was not part of Phase Y scope.
- **Phase Z note:** Phase Z did not touch `theme-renderer.ts`. The block-level binding resolution gap remains.
- **Phase AA note:** Phase AA touched `theme-renderer.ts` for the head-assets path only (import + `buildLiquidThemeHeadAssets`). Block-level settings in `renderLiquidSectionBlocks` (the `resolveDynamicSourceDescriptors` call site) was not modified. Gap remains. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not touch `renderLiquidSectionBlocks` or the block-level `resolveDynamicSourceDescriptors` call site. The merge engine operates on ThemeDocument structure before publish; it does not touch the renderer's block iteration loop. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch `renderLiquidSectionBlocks`. The intent parser operates on ThemeDocument structure, not on the renderer block loop. Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or first `theme-renderer.ts` touch affecting the block-level settings path.

## Phase Y risks

### RISK-Y01 — `MAX_APP_BLOCKS_PER_SLOT` not enforced in the renderer's block iteration loop — [LOW]
- **Status:** OPEN · defence-in-depth gap; introduced Phase Y (2026-07-11).
- **Introduced:** Phase Y (2026-07-11).
- **Evidence:** `packages/theme-engine/src/app-block-model.ts` — `validateAppBlockReferences` enforces `MAX_APP_BLOCKS_PER_SLOT = 20` at reference-construction / save time. `packages/theme-engine/src/theme-renderer.ts` — `renderLiquidSectionBlocks` iterates `orderedKeys(input.section.blocks, ...)` without tracking the count of `isLiquidAppBlockType` blocks per section. A crafted `input.section.blocks` object with more than 20 `@app` entries would render all of them without hitting a render-time cap.
- **Why it matters:** Validation-layer enforcement (at save time) is the primary control. The render boundary lacks the corresponding defence-in-depth count cap. In the current architecture all bundle data flows through `LiquidThemePackageBundleSchema.parse` before storage, so exploitation requires bypassing the bundle schema (which enforces `superRefine` structural checks). The missing render-time cap is a defence-in-depth gap, not a directly exploitable path.
- **Disposition:** Fix: in the `isLiquidAppBlockType` branch of `renderLiquidSectionBlocks`, maintain an `appBlockCount` counter per section. When `appBlockCount > MAX_APP_BLOCKS_PER_SLOT`, emit `APP_BLOCK_ERROR_PLACEHOLDER_CLASS` and `continue` (matching the crash-isolation pattern) instead of resolving the block. Import `MAX_APP_BLOCKS_PER_SLOT` from `./app-block-model` (already imported in Phase Y for `APP_BLOCK_ERROR_PLACEHOLDER_CLASS`). Add a test asserting that block 21 produces an error-placeholder and blocks 1–20 render normally.
- **Phase Z note:** Phase Z did not touch `theme-renderer.ts`. The gap remains.
- **Phase AA note:** Phase AA touched `theme-renderer.ts` for the head-assets path only (import + `buildLiquidThemeHeadAssets`). The `renderLiquidSectionBlocks` app-block count loop was not added. Gap remains. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not add an `appBlockCount` per-section cap to `renderLiquidSectionBlocks`. The merge engine writes the merged ThemeDocument before publish and does not interact with the block iteration loop. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not add an `appBlockCount` per-section cap to `renderLiquidSectionBlocks`. The intent parser operates on ThemeDocument structure. Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or earliest phase touching `theme-renderer.ts`.

## Phase Z risks

### RISK-Z01 — `buildCandidates('en')` orders bare `'en'` before `'en-IN'` — India-first inverted for stores with `locale='en'` — [MEDIUM]
- **Status:** OPEN · correctness gap; introduced Phase Z (2026-07-11).
- **Introduced:** Phase Z (2026-07-11).
- **Evidence:** `packages/theme-engine/src/theme-locale.ts` — `buildCandidates('en')` produces `['en', 'en-IN']` because the dedup loop starts with `normalized = 'en'`, then `language = 'en'` (deduplicated, skipped), then `THEME_DEFAULT_STORE_LOCALE = 'en-IN'`. Bare `'en'` occupies index 0 and `'en-IN'` falls to index 1. For a bundle with both `'en.general.title' = 'Sale'` and `'en-IN.general.title' = 'Sale – India'`, `tLocale('general.title', 'en', bundle)` returns `'Sale'` — the India-first intent is silently inverted.
- **Why it matters:** Stores whose `sites.locale` column is exactly `'en'` (bare) will have `tLocale` resolve to the bare `'en'` dictionary instead of the `'en-IN'` dictionary. The DB default on store creation is `'en-IN'` (`stores.ts:686`), so most stores are unaffected. Stores migrated from older schemas or created via direct DB insert without the default, or administrative seeding, may carry bare `'en'`. The primary platform paths (storefront hydration, Liquid `t` filter) use their own pre-Phase-Z fallback chains and are not directly affected by Phase Z's `tLocale`. The bug affects callers of the new `tLocale` export.
- **Suggested fix:** In `buildCandidates`, special-case bare `'en'`: when `normalized === 'en'` and `language === 'en'` (no region tag), build the candidate list as `[THEME_DEFAULT_STORE_LOCALE, 'en']` instead of starting with `'en'`. Add test: `tLocale('general.cart', 'en', bundle_with_both)` must return the `en-IN` value.
- **Phase AA note:** Phase AA did not touch `theme-locale.ts`. Gap remains. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not touch `theme-locale.ts`. The merge engine classifies settings and merges documents without calling `buildCandidates`. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch `theme-locale.ts`. The intent parser does not call `buildCandidates`. Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or earliest phase touching `theme-locale.ts`.

### RISK-Z02 — Pre-existing `lookupTranslation` in `theme-renderer.ts` lacks `BLOCKED_PATH_SEGMENTS` guard — [LOW]
- **Status:** OPEN · pre-existing security gap (NOT introduced by Phase Z); surfaced by Phase Z security review.
- **Introduced:** Pre-Phase-Z baseline; surfaced in Phase Z review (2026-07-11).
- **Evidence:** `packages/theme-engine/src/theme-renderer.ts` lines 1118–1136 — `lookupTranslation` (the Liquid `t` filter's internal resolver) traverses dot-path segments with `(current as Record<string, unknown>)[segment]` without checking `BLOCKED_PATH_SEGMENTS`. A segment value of `'__proto__'`, `'constructor'`, or `'prototype'` reaches the unguarded bracket accessor. Phase Z's new `lookupPath` in `theme-locale.ts` correctly blocks these segments. The pre-existing Liquid path does not.
- **Why it matters:** Impact is bounded — read-only access on first-party bundles that flow through `LiquidThemePackageBundleSchema.parse` before use. Bundle schema validation runs before any translation lookup. No write path. Defence-in-depth gap rather than a directly exploitable vector.
- **Suggested fix:** Import `BLOCKED_PATH_SEGMENTS` (export from `theme-locale.ts`) into `theme-renderer.ts` and add `if (BLOCKED_PATH_SEGMENTS.has(segment)) return undefined;` at the top of the `lookupTranslation` reduce callback, mirroring Phase Z's `lookupPath`.
- **Phase AA note:** Phase AA touched `theme-renderer.ts` (import line + `buildLiquidThemeHeadAssets` body, lines 33–34 and 306–326). `lookupTranslation` at lines 1118–1136 was not modified. Gap remains. Retarget: first `theme-renderer.ts` touch at or after the line-585 render-path wiring.
- **Phase AB note:** Phase AB did not touch `lookupTranslation` at lines 1118–1136 of `theme-renderer.ts`. Gap remains. Retarget: first `theme-renderer.ts` touch that wires the line-585 custom-CSS render path.
- **Target:** Phase AC or first `theme-renderer.ts` touch after line-585 custom-CSS render-path wiring.

### RISK-Z03 — Translation POST proxy does not validate `resource_type` at the proxy layer — [LOW]
- **Status:** OPEN · defence-in-depth gap; introduced Phase Z (2026-07-11).
- **Introduced:** Phase Z (2026-07-11).
- **Evidence:** `apps/merchant-control-plane/src/app/api/stores/[store]/localization/translations/route.ts` — the POST handler casts the request body as `CreateStorefrontTranslationInput` without runtime validation. A merchant calling the endpoint directly can supply `resource_type: 'product'` or any other enum value. The gateway's `CreateStorefrontTranslationSchema` validates the enum and rejects `section_definitions`; RISK-DUAL-N01 is not broken at the persistence layer. The proxy adds no explicit intent boundary enforcement.
- **Why it matters:** The proxy is the first defensive layer. Its absence means a non-`theme` `resource_type` reaches the gateway and is rejected there rather than at the nearest boundary.
- **Suggested fix:** Add a Zod parse or literal check at the proxy: return 400 if `body.resource_type !== 'theme'` before forwarding to the gateway.
- **Phase AA note:** Phase AA did not touch the translations POST proxy route. Gap remains. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not touch the translations POST proxy route. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch the translations POST proxy route. Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or first touch of this proxy route.

### RISK-Z04 — Translation DELETE proxy has no server-side guard against deleting default-locale (en-IN) rows — [LOW]
- **Status:** OPEN · API boundary gap; introduced Phase Z (2026-07-11).
- **Introduced:** Phase Z (2026-07-11).
- **Evidence:** `apps/merchant-control-plane/src/app/api/stores/[store]/localization/translations/[translationId]/route.ts` — the DELETE handler calls `deleteTranslation` without checking whether the targeted translation row belongs to the store's default locale (`en-IN`). The UI omits a delete button for the default locale (documented in `TranslationEditorClient` and `LocaleSwitcher`), but a direct API call bypasses the UI guard.
- **Failure scenario:** Merchant sends `DELETE /api/stores/mystore/localization/translations/<uuid-of-en-IN-key>` via cURL. `resolveOwnedStoreId` passes. The gateway deletes the row. `tLocale('general.cart', 'hi-IN', bundle)` then falls through `en-IN` (deleted), then bare `en` (absent), and returns `'general.cart'` as the raw key path — displayed to customers.
- **Suggested fix:** In the proxy DELETE handler or the gateway's `deleteTranslation` handler: fetch the translation row, check its locale against the store's default locale, and reject with 400 if `locale === 'en-IN'` (or `is_default = true` in `storefront_locales`). Gateway-layer enforcement provides stronger protection.
- **Phase AA note:** Phase AA did not touch the translations DELETE proxy route. Gap remains. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not touch the translations DELETE proxy route. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch the translations DELETE proxy route. Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or earliest security migration.

### RISK-Z05 — Translation POST proxy does not verify `resource_id` (themeId) belongs to the resolved `storeId` — [LOW]
- **Status:** OPEN · cross-tenant data injection risk; introduced Phase Z (2026-07-11).
- **Introduced:** Phase Z (2026-07-11).
- **Evidence:** `apps/merchant-control-plane/src/app/api/stores/[store]/localization/translations/route.ts` — the POST handler resolves `storeId` via `resolveOwnedStoreId` but does not verify that `body.resource_id` (themeId) belongs to `resolved.storeId`. A merchant who knows another tenant's `themeId` could POST translations scoped to that theme. Whether the write succeeds depends on the gateway/RLS layer; if there is any gap there, cross-tenant translation injection is possible.
- **Why it matters:** Tenancy enforcement at the proxy layer is defence-in-depth complementing the gateway/RLS. Its absence leaves the proxy as a pass-through for cross-tenant `resource_id` values.
- **Suggested fix:** After resolving `storeId`, verify `body.resource_id` ownership: call `api.themes.getById(body.resource_id)` and confirm `theme.store_id === resolved.storeId`. Return 403 on mismatch.
- **Phase AA note:** Phase AA did not touch the translations POST proxy route (`resource_id` ownership check). Gap remains. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not touch the translations POST proxy route or add `resource_id` ownership verification. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch the translations POST proxy route or add `resource_id` ownership verification. Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or first touch of this proxy route.

### RISK-Z06 — Gateway `deleteTranslation` handler has no locale guard — [LOW]
- **Status:** OPEN · gateway-layer gap; backend counterpart of RISK-Z04.
- **Introduced:** Phase Z (2026-07-11) — Phase Z surfaced this gap but did not introduce it (pre-existing gateway handler).
- **Evidence:** `services/api-gateway/src/routes/stores-localization.ts` — the DELETE handler at `/v1/stores/:id/localization/translations/:translationId` soft-deletes any row matching `translationId + storeId` without checking whether the row's locale is the store's default locale (`is_default = true` in `storefront_locales`). Phase Z did not modify this file.
- **Why it matters:** RISK-Z04 (proxy-layer) and RISK-Z06 (gateway-layer) are complementary. Full closure requires a guard at the gateway level so that the deletion of default-locale rows is rejected regardless of which proxy or client is used.
- **Suggested fix:** In the gateway DELETE handler: fetch the translation row, join to `storefront_locales` on `(store_id, locale)`, and return 400 if `is_default = true`. Alternatively, add a `p_locale` parameter to the `delete_storefront_translation` DB function and block deletion of the default locale there.
- **Phase AA note:** Phase AA did not touch `stores-localization.ts`. Gap remains. Retarget: Phase AB.
- **Phase AB note:** Phase AB did not touch `stores-localization.ts`. Gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch `stores-localization.ts`. Gap remains. Retarget: Phase AD.
- **Target:** Phase AD or earliest security migration. Aligns with RISK-Z04.

## Phase AA risks

### RISK-AA-01 — Test AA-SEC-07b is tautological — unicode-decode step not isolated as sole blocking mechanism — [LOW]
- **Status:** OPEN · test coverage gap; introduced Phase AA (2026-07-11).
- **Introduced:** Phase AA (2026-07-11).
- **Evidence:** `packages/theme-engine/test/custom-css-sanitizer.test.ts` — test `AA-SEC-07b` ("blocks CSS unicode escape for `<`") uses the payload `\3c /style\3e`. After Step 2 decoding this becomes `< /style>`, which is caught by the literal `<` angle-bracket pattern in the validator. The test would pass even if Step 2 (Unicode hex decode) were completely disabled, because the `<` check runs on the normalised string which, in this case, receives a literal `<` that would also have passed the `<` check directly without any decoding. The test does not provide independent proof that Step 2 is the mechanism blocking a payload where `<` appears ONLY in escaped form.
- **Why it matters:** If Step 2 were accidentally removed or its regex broken, AA-SEC-07b would still pass, giving a false-green signal. The coverage gap means that a regression in the unicode decode step would not be caught by the test suite.
- **Suggested fix:** Add a complementary test `AA-SEC-07c` where the payload uses the unicode escape form ONLY — i.e., the raw payload string contains `\3c` (the escape characters, not the `<` character itself) and nothing that would otherwise be caught by the `<` pattern. The test must also assert that Step 2 is needed to decode it. One approach: verify that `decodeCssUnicodeEscapes` alone transforms the payload to contain `<`, then run the full validator.
- **Phase AB note:** Phase AB did not touch `custom-css-sanitizer.test.ts`. The test coverage gap for AA-SEC-07b remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch `custom-css-sanitizer.test.ts`. The test coverage gap remains. Retarget: Phase AD.
- **Target:** Phase AD or next `custom-css-sanitizer.test.ts` touch.

### RISK-AA-02 — `expression()` comment-split bypass — test coverage incomplete — [LOW]
- **Status:** OPEN · test gap; deferred from Phase AA hardening (2026-07-11).
- **Introduced:** Phase AA (2026-07-11).
- **Evidence:** The CSS payload `ex/**/pression()` contains the expression keyword split by a block comment. Step 1 (strip block comments) removes `/* */`, producing `expression()`. Step 4 (whitespace collapse) then normalises any remaining whitespace. The concatenated result `expression()` would then be caught by the `expression(` pattern check. So the bypass does NOT succeed in Phase AA's current implementation — the step ordering is correct. However, there is no explicit test for this specific split form in `custom-css-sanitizer.test.ts`. Without a test, a future refactor that changes step ordering (e.g., swapping Steps 1 and 4) could inadvertently re-enable the bypass without a visible test failure.
- **Why it matters:** The correct step-ordering defence for comment-split is fragile — it relies on Step 1 running before pattern checks, which is enforced by the code's sequential execution but not by a test that proves the bypass is blocked in the presence of a `/* */`-split.
- **Suggested fix:** Add test `AA-SEC-EX01`: input = `` `ex/**/pression(alert(1))` ``, expect `{ ok: false, violations: [{ code: 'UNSAFE_EXPRESSION' }] }`. This locks in the split-comment-then-check behavioural contract.
- **Phase AB note:** Phase AB did not touch `custom-css-sanitizer.test.ts`. The `expression()` comment-split test gap remains. Retarget: Phase AC.
- **Phase AC note:** Phase AC did not touch `custom-css-sanitizer.test.ts`. The test gap remains. Retarget: Phase AD.
- **Target:** Phase AD or next `custom-css-sanitizer.test.ts` touch.

### RISK-AA-03 — CSS nesting browser floor — `.lb-theme { }` wrapper requires Chrome 112+/Firefox 117+/Safari 17.2+ — [LOW]
- **Status:** OPEN · platform constraint; accepted for Phase AA (2026-07-11).
- **Introduced:** Phase AA (2026-07-11).
- **Evidence:** `packages/theme-engine/src/custom-css-sanitizer.ts` — `buildScopedCustomCss` (and by extension `validateAndScopeCustomCss`) wraps valid merchant CSS as `${scopeSelector}{${trimmed}}` (CSS nesting syntax). Native CSS nesting is supported in Chrome 112+, Firefox 117+, Safari 17.2+. Browsers below these versions do not support native nesting — the `.lb-theme { }` wrapper will not scope the inner CSS, which will instead apply globally to the document. For a storefront served to a user on Chrome 100 (for example), all merchant CSS selectors would escape the `.lb-theme` scope.
- **Why it matters:** Unscoped merchant CSS can target admin chrome, editor preview frames, or any DOM element. The scoping invariant is a core SAFE-CSS LAW property. Its absence on older browsers reintroduces a selective CSS-scope bypass.
- **Acceptance rationale:** India-first market Chrome adoption is strongly biased toward Chrome 112+ as of 2026 (Chrome's auto-update policy dominates). The risk is accepted for Phase AA. A fallback approach (e.g., duplicating every merchant selector with an explicit `.lb-theme ` prefix using a PostCSS transform at store time) is possible but significantly more complex.
- **Disposition:** Accepted for India-first market. Monitor browser floor requirements; revisit if support target changes or if storefront analytics identify significant sub-112 Chrome usage. A PostCSS `@scope`-polyfill or manual prefix approach can be added in a future phase if needed.
- **Target:** Accepted — revisit if browser floor requirements change or if sub-Chrome-112 storefront traffic exceeds 1% based on analytics.

## Phase AB risks

### RISK-AB-01 — Concurrent same-hash POST requests can create duplicate releases — [LOW]
- **Status:** OPEN · known residual; ARB-gated.
- **Introduced:** Phase AB (2026-07-11).
- **Evidence:** `services/api-gateway/src/routes/themes/theme-update-route.ts` — the POST apply handler recomputes `SHA-256(JSON.stringify(diff))` and compares it to `confirm_diff_hash`. Two concurrent POST requests with the same valid `diffHash` (from the same prior preview) both pass the comparison independently before either write lands. Both then call `publishVersionUpdateRelease`. The `idempotency_key` pre-check prevents duplicate writes only when both requests share the same key; two requests with different idempotency keys (or no key) both succeed, potentially creating two release records with identical merged document content. No merchant content is lost (both produce identical merged documents), but duplicate release history entries accumulate.
- **Why it matters:** Duplicate releases inflate release history and may race the `is_current` pointer in edge cases. The dominant real-world pattern (sequential submit) is correctly handled — only simultaneous window-race submissions are affected.
- **Disposition:** Full closure requires a DB-level advisory lock inside the `publish_theme_release` SECURITY DEFINER RPC — `pg_advisory_xact_lock(hashtext(store_id || ':version_update'))` wrapping the release insert. ARB sign-off required (SECURITY DEFINER modification). Documented at code level in the route.
- **Phase AC note:** Phase AC did not touch the `publish_theme_release` SECURITY DEFINER RPC. Gap remains.
- **Target:** ARB-gated follow-up. Phase AD or earliest phase touching the `publish_theme_release` RPC.

### RISK-AB-02 — Foreign WIP isolation test scope limited to AB symbol absence — [LOW]
- **Status:** OPEN · test scope gap; deferred.
- **Introduced:** Phase AB (2026-07-11).
- **Evidence:** `apps/merchant-control-plane/package.json` — the Phase AB test file `theme-editor-ab.test.mjs` includes a foreign WIP isolation suite that asserts Phase AB symbols (`planThemeSafeUpdate`, `ThemeUpdatePanel`, `update-preview`, `update`) are not introduced in `themes/[themeId]/editor/page.tsx` and `ThemeEditorLayout.tsx`. This test confirms no AB-scoped imports were added to foreign WIP files; it does NOT detect or validate other potential changes to those files that may be part of foreign WIP. The isolation boundary is symbol-level, not file-level diff.
- **Why it matters:** A foreign WIP commit to `editor/page.tsx` that does not introduce AB symbols would pass the isolation test while still potentially conflicting with AB's intent. The test is a best-effort checkpoint, not a comprehensive diff guard.
- **Disposition:** The test is sufficient for Phase AB's actual scope (ThemeUpdatePanel is a standalone page/component, not embedded in the main editor flow). If future phases integrate version-update flows into the main editor frame, the isolation test perimeter should be expanded accordingly.
- **Target:** Revisit if Phase AD or a future phase integrates version update into `editor/page.tsx`.

### RISK-AB-03 — Api-gateway pre-existing failure documented by position (#298) not by test name — [LOW]
- **Status:** OPEN · test suite observability gap; deferred.
- **Introduced:** Phase AB (2026-07-11).
- **Evidence:** The Phase AB test report documents "1 pre-existing failure: test #298 (a DB-dependent rollback-requires-current-release test failing because no live DB is available in the test environment)." The failure is identified by its ordinal position in the test runner output rather than by a stable test name. If the test suite order changes (a new test inserted before #298), the position number shifts and the documentation becomes incorrect.
- **Why it matters:** Future phase engineers comparing the pre-existing failure set against the documented baseline may count a different test at position #298 after test-suite reordering, making it harder to confirm the failure is pre-existing rather than a new regression.
- **Suggested fix:** Identify the failing test by its describe + it string ("rollback · requires current release id · rejects when release is not current" or similar) and replace the position reference with the quoted test name in the test report. Update the pre-existing-failure baseline in `package.json` or a dedicated fixture.
- **Target:** Phase AD or next api-gateway test suite touch. Low urgency — the failure is deterministic (no live DB) and stable across builds.

## Phase AC risks

### RISK-AC-01 — Proxy does not filter overlay keys before forwarding — defense-in-depth gap — [MEDIUM]
- **Status:** OPEN · latent while gateway NOT-CONNECTED; defense-in-depth gap.
- **Introduced:** Phase AC (2026-07-11).
- **Evidence:** `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/ai-customization/route.ts` — the POST handler serialises the browser-supplied `overlay` object verbatim without an allowlist filter on overlay keys before forwarding. A crafted POST with `overlay: { section_definitions: {...} }` would be forwarded. Today the gateway returns 404/503 (NOT-CONNECTED) so no write lands. The RISK-DUAL-N01 constraint is documented in the comment header but not mechanically enforced at the proxy layer.
- **Why it matters:** Defense-in-depth at the proxy layer requires that structural keys (`section_definitions`, `block_definitions`, `layout`, `locales`, `renderer`) are stripped before the payload reaches the gateway. When the gateway route is deployed, the proxy becomes the first enforcement layer.
- **Suggested fix:** Before forwarding, parse the overlay through an allowlist of accepted `ExperienceToken` keys. Use `ExperienceSettingsOverlaySchema` from `packages/theme-engine/src/theme-presets.ts` or an equivalent `pick`/`strip`. Return 422 if overlay fails validation. See PHASE_AC_SECURITY_REVIEW.md Finding 1.
- **Target:** Phase AD or when the gateway AI-customization route is deployed, whichever is first.

### RISK-AC-02 — `handleAccessibilityFixIntent` WCAG AA guarantee holds only against white background — [MEDIUM]
- **Status:** OPEN · correctness gap; introduced Phase AC (2026-07-11).
- **Introduced:** Phase AC (2026-07-11).
- **Evidence:** `packages/theme-engine/src/ai-intent-parser.ts` — `handleAccessibilityFixIntent` derives `newTextColor` via `generateColorSystem(primaryColor, 'light').text` which is validated against `#FFFFFF` internally. No post-fix `meetsWcagAA(newTextColor, backgroundColor)` assertion exists for the document's actual `backgroundColor`. For a `backgroundColor` of `#777777` (luminance ~0.152), a text color that passes against `#FFFFFF` (~4.6:1) may fail against `#777777` (~3.6:1). The diff summary `'to meet WCAG 2.1 AA contrast against {backgroundColor}'` is inaccurate in this scenario. Tests `AC/a11y-fix-fail` only exercise `backgroundColor='#FFFFFF'`.
- **Why it matters:** The WCAG AA guarantee is a stated invariant of the Phase AC engine. Merchants with non-white backgrounds will receive a WCAG-invalid accessibility fix while the diff summary claims the fix is compliant.
- **Suggested fix:** After computing `newTextColor`, add: `if (!meetsWcagAA(newTextColor, backgroundColor)) { /* loop or fallback to #000000 */ }`. Update test suite to cover `backgroundColor='#888888'`.
- **Target:** Phase AD or next `ai-intent-parser.ts` touch.

### RISK-AC-03 — `TYPOGRAPHY_OVERLAY_KEYS` in panel omits `bodyFontFamily` — [LOW]
- **Status:** OPEN · latent while gateway NOT-CONNECTED.
- **Introduced:** Phase AC (2026-07-11).
- **Evidence:** `apps/merchant-control-plane/src/components/theme-editor/AICustomizationPanel.tsx` — `TYPOGRAPHY_OVERLAY_KEYS` contains only `['fontFamily', 'headingFontFamily']`. The engine's `handleTypographyIntent` correctly writes three keys: `fontFamily`, `headingFontFamily`, `bodyFontFamily`. `ExperienceSettingsOverlaySchema` in `theme-presets.ts` is `.strict()` and requires `bodyFontFamily`. When the gateway route is deployed, typography Apply requests from the panel will fail gateway validation. Liquid render paths that resolve `bodyFontFamily` will not receive the updated value.
- **Why it matters:** Typography proposals from the panel will silently fail or partially apply once the gateway route is live. The engine sets all three keys correctly; the panel overlay is incomplete.
- **Suggested fix:** Add `'bodyFontFamily'` to `TYPOGRAPHY_OVERLAY_KEYS` and set `overlay.bodyFontFamily = pairing.fontFamily` in the proposal builder, mirroring `buildExperienceSettingsOverlay` in `theme-presets.ts`. Add a panel-level test asserting all three keys appear in the overlay.
- **Target:** Phase AD or when the gateway AI-customization route is deployed.

### RISK-AC-04 — `'computing'` state dead due to React 18 synchronous batch — [LOW]
- **Status:** OPEN · cosmetic; no correctness or security impact.
- **Introduced:** Phase AC (2026-07-11).
- **Evidence:** `apps/merchant-control-plane/src/components/theme-editor/AICustomizationPanel.tsx` — `handleSelectIntent` is synchronous. React 18 batches `setPanelState('computing')` and `setPanelState('preview')` into a single flush. The `'computing'` skeleton (`aria-busy`) is never rendered between user click and preview display.
- **Why it matters:** Cosmetic — the UI does not show a loading skeleton between user click and proposal display. Correctness unaffected. The `'computing'` branch is dead UI.
- **Suggested fix:** Wrap proposal computation in `setTimeout(..., 0)` or `startTransition`. Alternatively, remove the `'computing'` branch and document only `'idle | preview | applying | applied | error'` as reachable states.
- **Target:** Phase AD — low priority cosmetic fix.

### RISK-AC-05 — `AC/no-model` test uses bare substrings not anchored to import paths — [LOW]
- **Status:** OPEN · test quality gap; no correctness risk.
- **Introduced:** Phase AC (2026-07-11).
- **Evidence:** `packages/theme-engine/test/ai-intent-parser.test.ts` — `FORBIDDEN_PATTERNS` uses bare substrings `'openai'` and `'anthropic'` (not anchored as `"from 'openai'"` or `"from '@anthropic-ai'"`). A future comment like `// not using openai` in `ai-intent-parser.ts` would make the test fail as a false positive. Currently harmless — neither string appears anywhere in `ai-intent-parser.ts`.
- **Why it matters:** False positive risk on future comments. Currently harmless.
- **Suggested fix:** Anchor the patterns: e.g., `"from 'openai'"`, `"from '@anthropic-ai'"`.
- **Target:** Phase AD or next `ai-intent-parser.test.ts` touch.

## Phase AE risks

### RISK-AE-SEC-001 (FIND-AE-SEC-001) — `walkStringLeaves` depth cap at 4 allows CSS injection bypass at settings_data.current depth ≥ 5 — [MEDIUM] — FIXED
- **Status:** FIXED in Phase AE hardening (2026-07-11) · was: OPEN correctness gap introduced Phase AE.
- **Introduced:** Phase AE (2026-07-11).
- **Evidence (defect):** `packages/theme-engine/src/theme-marketplace-contract.ts` — the original `if (depth > 4) return;` silently stopped traversal. The `ThemeBundleJsonObjectSchema` (via `z.lazy()`) for `settings_data.current` has no depth bound, so a bundle with `settings_data.current.a.b.c.d.e = '@import url(evil);'` passed Stage K (Zod accepts arbitrary depth), had the CSS injection string silently skipped by Stage AA (depth 5 > cap), and returned `ok: true` — incorrectly.
- **Why it mattered:** The documented contract promises "validate every string leaf in settings_data.current" but the implementation did not deliver that for depth ≥ 5 — a real bypass in the program's capstone marketplace safety gate.
- **Remediation (Phase AE hardening):** two-part fail-closed fix in `theme-marketplace-contract.ts`: (1) the cap was raised to `MAX_SETTINGS_WALK_DEPTH = 12`, well above the deepest legitimate theme setting (nested blocks are themselves bounded at `MAX_BLOCK_DEPTH = 3`), so no clean bundle is ever truncated; (2) truncation is now **fail-closed** — if the walker reaches the cap with content still below it, it records the truncation and the caller pushes a blocking `AA:settings-too-deep` violation, so an over-deep bundle is REJECTED rather than admitted with an un-scanned blind spot. Locked by two new tests: `AE-AA-07` (depth-5 `@import` now rejected) and `AE-AA-08` (settings nested beyond the cap rejected fail-closed). theme-engine gate **1726/1726**, typecheck clean.
- **Residual:** none. The fail-closed truncation means even an adversarially ultra-deep bundle cannot bypass the CSS scan.

### RISK-AE-TEST-002 (FIND-AE-TEST-002) — AE-K-05 inner assertion uses a redundant OR condition — [LOW]
- **Status:** OPEN · test quality; no correctness risk; introduced Phase AE (2026-07-11).
- **Introduced:** Phase AE (2026-07-11).
- **Evidence:** `packages/theme-engine/test/theme-marketplace-contract.test.ts` test `AE-K-05` — inner for-loop uses `v.code === \`K:${v.code.slice(2)}\` || v.stage === 'K'`. For any Stage K violation both disjuncts are true simultaneously; only `v.stage === 'K'` is meaningful.
- **Suggested fix:** Replace with `assert.equal(v.stage, 'K', ...)`.
- **Target:** Cosmetic; first touch of `theme-marketplace-contract.test.ts`.

### RISK-AE-SEC-003 (FIND-AE-SEC-003) — user_id = auth.uid() cross-UUID-space residual in migration 191 — [LOW]
- **Status:** OPEN · residual architectural risk; not introduced by Phase AE — it is a known limitation of the `users_custom.id` vs `auth.users.id` architecture.
- **Introduced:** Documented in Phase AE (2026-07-11); pre-dates this program.
- **Evidence:** `database/supabase/migrations/191_theme_purchases_rls_tenant_scope.sql` — `tp_authenticated_select` and `tp_authenticated_insert` use `user_id = auth.uid()`. `theme_purchases.user_id` FK → `users_custom(id)`, a separate UUID space from Supabase `auth.users.id`. If a `users_custom.id` value ever coincidentally matches a different user's `auth.uid()`, that user would gain access to the other's purchase rows. Current architecture makes this effectively impossible (UUID collision); gateway always uses service_role.
- **Why it matters:** Structural dependency on UUID-space non-overlap rather than a FK relationship between the two tables.
- **Suggested fix (long-term):** Add `auth_id uuid REFERENCES auth.users(id)` to `users_custom` and rewrite the RLS policies as `auth_id = auth.uid()`. Requires a separate migration + ARB approval.
- **Target:** First `users_custom` schema migration (separate from theme program scope).
