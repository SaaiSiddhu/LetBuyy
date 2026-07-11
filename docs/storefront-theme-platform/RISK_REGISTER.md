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

## Phase X risks

### RISK-X01 — R2 storage key path is user-scoped, not site-scoped — [LOW]
- **Status:** OPEN · known residual; deferred.
- **Introduced:** Phase X (2026-07-11).
- **Evidence:** `services/api-gateway/src/routes/upload.ts` — storage key: `${folder}/${auth.user.id}/${Date.now()}-${uuid}.${ext}`. The `folder` is `<storeId>/products` (set by the merchant proxy), but the key component directly after `folder` is `auth.user.id`, not `site_id`. Two stores owned by the same `user.id` would share the user-id segment in their R2 key paths. Cross-store read isolation relies exclusively on `verifySiteOwnership` at the API layer — an actor cannot request another store's CDN URL through the gateway, but if a CDN URL were somehow shared out-of-band, the R2 bucket's key structure would not provide an additional isolation boundary.
- **Why it matters:** True defence-in-depth key isolation would use `${siteId}/${userId}/...` so that even if the API layer failed, R2 bucket policies could scope by site prefix. The current structure requires the API-level `verifySiteOwnership` as the sole isolation boundary, which is correct and tested (X-T04) but is a single-layer defence.
- **Disposition:** Fix: update the key format to `${folder}/${siteId}/${auth.user.id}/${timestamp}-${uuid}.${ext}` where `siteId` is the verified store's UUID (already available in the upload handler after `verifyUploadStoreOwnership`). This is a non-breaking change if applied going forward; existing CDN URLs remain valid (the CDN serves whatever key was used at upload time). A future migration would be required to rename existing keys for full parity. **Target:** first security migration or Phase Z if touching `upload.ts`.
- **Phase Y note:** Phase Y did not touch `upload.ts`. The gap remains.
- **Current isolation:** API-level `verifySiteOwnership` is tested (X-T04), enforced consistently, and provides the correct boundary for all current attack scenarios.

### RISK-T01 — Pre-Zod stack-depth attack via `z.lazy()` recursion — [MEDIUM]
- **Status:** OPEN · known residual; deferred.
- **Introduced:** Phase T (2026-07-11).
- **Evidence:** `packages/theme-engine/src/theme-bundle.ts:1420` — `parseLiquidThemePackageBundle` calls `LiquidThemePackageBundleSchema.parse(input)` directly without a pre-Zod structural depth check. `ThemeBundleTemplateBlockSchema` is self-recursive via `z.lazy()`. A crafted bundle JSON with extreme nesting depth (e.g., 100 levels, achievable within the request body size before Cloudflare's generic limits apply) would overflow the V8 call stack during Zod's `_parse` recursion before the `superRefine` depth check fires, producing a `RangeError: Maximum call stack size exceeded`. `parseThemeDocument` has the same gap: `assertNoBlockedKeysInRaw` (which runs pre-Zod) checks key blocklist at depth-128 but does not limit structural depth.
- **Why it matters:** An authenticated merchant (or a crafted bundle file in an upload flow) could trigger a Worker crash via a deep-nesting attack. Cloudflare Worker per-request CPU limits and memory limits provide some containment, but a RangeError is less clean than a 400 ZodError and may interfere with error handling pipelines.
- **Disposition:** Full closure requires adding a fast iterative pre-Zod structural depth check to `parseLiquidThemePackageBundle` (after `assertNoBlockedKeysInRaw`-style call) and optionally to `parseThemeDocument`. Additionally, adding an explicit `bodyLimit` middleware to the theme package upload route reduces blast radius. Deferred from Phase T to avoid touching production parse paths without dedicated test coverage for the pre-check logic in the bundle context.
- **Phase X note:** Phase X did not touch `theme-bundle.ts` or `parseLiquidThemePackageBundle`. The gap remains.
- **Phase Y note:** Phase Y did not touch `theme-bundle.ts` or `parseLiquidThemePackageBundle`. The gap remains.
- **Target:** Earliest phase touching `parseLiquidThemePackageBundle` or the upload route.

### RISK-T02 — No `assertNoBlockedKeysInRaw` in `parseLiquidThemePackageBundle` — [MEDIUM]
- **Status:** OPEN · known residual; deferred.
- **Introduced:** Phase T (2026-07-11).
- **Evidence:** `packages/theme-engine/src/theme-document.ts:493` calls `assertNoBlockedKeysInRaw(input)` before `ThemeDocumentSchema.parse(input)`. `packages/theme-engine/src/theme-bundle.ts:1420` (`parseLiquidThemePackageBundle`) does NOT call `assertNoBlockedKeysInRaw`. Phase T introduced nested block settings (`ThemeBundleTemplateBlockSchema.blocks[id].settings`) parsed via `z.record(z.string(), ThemeBundleJsonSchema)`. A key `"__proto__"` in block settings will invoke the prototype setter on the parsed output object, silently changing its `[[Prototype]]`. The downstream `filterBlockedSettingsKeys` in the renderer never sees `__proto__` via `Object.keys` because V8 does not return it from `Object.keys` after a prototype mutation.
- **Why it matters:** An attacker-supplied `block.settings.__proto__` value could expose attacker-controlled inherited properties via `{{ block.settings.admin }}` in a Liquid template. Impact is bounded to the merchant's own storefront; no cross-tenant blast radius.
- **Disposition:** Fix: call `assertNoBlockedKeysInRaw` (already exported from `theme-document.ts`) at the top of `parseLiquidThemePackageBundle`. One-line call site change; no schema-level side effects. Deferred from Phase T to avoid touching the production parse path without dedicated bundle-context test coverage.
- **Phase X note:** Phase X did not touch `parseLiquidThemePackageBundle`. The gap remains.
- **Phase Y note:** Phase Y did not touch `parseLiquidThemePackageBundle`. The gap remains.
- **Target:** Earliest phase touching `parseLiquidThemePackageBundle`.

### RISK-T03 — Block settings bypass `filterBlockedSettingsKeys` in the renderer — [LOW]
- **Status:** PARTIALLY CLOSED (Phase Y, 2026-07-11) · app-block path now protected; non-app block path still open.
- **Introduced:** Phase T (2026-07-11). Pre-existing for flat blocks; Phase T's `sub_blocks` threading adds a second unfiltered position.
- **Evidence:** `packages/theme-engine/src/theme-renderer.ts:818` — `settings: block.settings` and `theme-renderer.ts:824` — `settings: child.settings` (in `sub_blocks[]`) are inserted raw into the Liquid scope without calling `filterBlockedSettingsKeys`. The `BLOCKED_DROP_KEYS` set (which excludes `api_key`, `webhook_secret`, etc.) is applied only to the global `settings` drop (line 883), not to block-level settings.
- **Why it matters:** Credential-named keys in merchant-authored `block.settings` are accessible via `{{ block.settings.api_key }}` without the blocked-key guard. All rendered HTML passes through DOMPurify but non-HTML-encoded plain strings are not stripped.
- **Phase Y resolution (partial):** Phase Y introduced `filterAppBlockSettings` (in `app-block-model.ts`) and applies it at the `isLiquidAppBlockType` branch in `renderLiquidSectionBlocks`. App-block settings (blocks of type `'@app'` or `'app:*'`) are now filtered before entering `LiquidRenderedBlock.settings` and the section-level Liquid drop. The `BLOCKED_APP_BLOCK_SETTING_KEYS` set (13 keys) mirrors `BLOCKED_DROP_KEYS`; parity asserted by test Y-13.
- **Remaining gap (non-app blocks):** `settings: block.settings` at line 818 and `settings: child.settings` at line 824 (non-app blocks and nested blocks) still bypass `filterBlockedSettingsKeys`. These lines are in the normal block render path (not the `isLiquidAppBlockType` branch) and were not modified in Phase Y.
- **Disposition:** Fix remaining gap: apply `filterBlockedSettingsKeys` to `block.settings` and `child.settings` at their Liquid scope insertion points (lines 818, 824). This is defence-in-depth; no legitimate merchant theme uses credential-adjacent key names in non-app block settings.
- **Target:** Phase Z or first phase touching `theme-renderer.ts` lines 818/824.

### RISK-T04 — `RENDERER_MAX_BLOCK_DEPTH` is private/unexported — depth parity test cannot directly assert it — [LOW]
- **Status:** OPEN · test quality gap; deferred past Phase U.
- **Introduced:** Phase T (2026-07-11).
- **Evidence:** `RENDERER_MAX_BLOCK_DEPTH = 3` is a private module-local constant in `theme-renderer.ts:950`. The test `nested-blocks: (f) RENDERER_MAX_BLOCK_DEPTH === MAX_BLOCK_NESTING_DEPTH` asserts `MAX_BLOCK_NESTING_DEPTH === 3` and `MAX_BUNDLE_BLOCK_NESTING_DEPTH === 3` but cannot directly assert the renderer constant. If the renderer constant were changed to 2, the test would still pass.
- **Disposition:** Fix: export `RENDERER_MAX_BLOCK_DEPTH` from `theme-renderer.ts` and add a direct equality assertion. Alternatively, add a behavioral test that renders a depth-3 fixture and verifies all three levels produce non-empty `sub_blocks`.
- **Phase U note:** Phase U did not touch `theme-renderer.ts`.
- **Phase V note:** Phase V did not touch `theme-renderer.ts`.
- **Phase X note:** Phase X did not touch `theme-renderer.ts`. The gap remains.
- **Phase Y note:** Phase Y touched `theme-renderer.ts` (2 hunks: import + `isLiquidAppBlockType` branch). `RENDERER_MAX_BLOCK_DEPTH` (a private const, not near the touched hunks) was not exported. The test quality gap remains.
- **Target:** Phase Z or first phase touching `theme-renderer.ts`.

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
- **Target:** Phase Z or first phase touching `SectionTreePanel.tsx`.

### RISK-T06 — `UnsupportedThemeDocumentFeatureError` exported but never thrown — [LOW]
- **Status:** OPEN · dead API; deferred past Phase U.
- **Introduced:** Phase N (2026-07-10). Became dead in Phase T (2026-07-11).
- **Evidence:** `packages/theme-engine/src/theme-document.ts:89–97` — `UnsupportedThemeDocumentFeatureError` is defined and exported. It was previously thrown by the Phase N fail-closed guard in `fromThemeDocumentV2` (lines 560–573, pre-Phase-T). That guard was removed in Phase T. A `grep` across all app and service source confirms no external catch sites for this class; it is dead public API.
- **Disposition:** Either re-purpose with updated JSDoc ("reserved for future phase-gated feature flags") or remove the class and its export entirely. Removal is safe since no catch sites exist.
- **Phase U note:** Phase U did not touch `theme-document.ts`.
- **Phase V note:** Phase V touched `theme-document.ts` to add the template-key `superRefine` and variant-cap enforcement, but did not remove or re-purpose `UnsupportedThemeDocumentFeatureError`. The class remains dead.
- **Phase X note:** Phase X did not touch `theme-document.ts`. The class remains dead.
- **Phase Y note:** Phase Y did not touch `theme-document.ts`. The class remains dead.
- **Target:** Phase Z or next `theme-document.ts` touch.

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
- **Target:** Phase Z or first `schema-field-extensions.ts` touch.

### RISK-SEC-U02 — `ColorBackgroundControl` gradient mode accepts arbitrary CSS content including `url()` — [MEDIUM]
- **Status:** OPEN · editor-side gap; render-time concern.
- **Introduced:** Phase U (2026-07-11).
- **Evidence:** `apps/merchant-control-plane/src/components/theme-editor/controls/ColorBackgroundControl.tsx` — in gradient mode, the `<Input type="text">` accepts any CSS string without validation. `validateFieldValue` for `color_background` has no type-specific CSS content check (falls through to `break`). A gradient string like `linear-gradient(to right, url(javascript:alert(1)), red)` passes the editor without rejection.
- **Why it matters:** The storefront renderer applies the `color_background` value as a CSS `background` property. If the frozen renderer does not sanitise `url()` expressions inside gradient strings, a CSS-injection attack path exists at render time. The editor itself does not apply the value as CSS, so no XSS in the editor. The risk is at render time in the storefront.
- **Disposition:** Add a gradient-mode validation rule in `validateFieldValue` for `color_background`: reject values containing `url(` or `expression(` (case-insensitive regex: `/url\s*\(/i`). This should live in `schema-field-extensions.ts` and mirror whatever the storefront renderer strips.
- **Phase V note:** Phase V did not touch `schema-field-extensions.ts` or `ColorBackgroundControl.tsx`.
- **Phase X note:** Phase X did not touch `schema-field-extensions.ts` or `ColorBackgroundControl.tsx`. The gap remains.
- **Phase Y note:** Phase Y did not touch `schema-field-extensions.ts` or `ColorBackgroundControl.tsx`. The gap remains.
- **Target:** Phase Z or first `schema-field-extensions.ts` touch.

### RISK-SEC-U03 — `required: true` on `checkbox` / `toggle` is a validation no-op — [MEDIUM]
- **Status:** OPEN · API design gap.
- **Introduced:** Phase U (2026-07-11).
- **Evidence:** `packages/theme-engine/src/schema-field-extensions.ts:validateFieldValue` — the required check rejects `null | undefined | ''`. `resolveFieldDefault` returns `false` for `checkbox` and `toggle`. `SchemaFormRenderer` passes `Boolean(value)` to boolean controls. A field with no stored value resolves to `false`, which passes the required check. A required checkbox never produces a validation error regardless of whether the merchant checked it.
- **Why it matters:** Theme schema authors who mark a checkbox `required` expect validation feedback when the merchant leaves it unchecked. The current behaviour silently ignores the requirement.
- **Disposition:** Options: (1) add a type-specific required guard for `checkbox`/`toggle`: `if (field.required && (type === 'checkbox' || type === 'toggle') && value === false) → error`. (2) Document `required` as inapplicable to boolean controls and omit `required` from `ToggleInput` / `CheckboxControl` rendering. (3) Introduce a separate property `must_be_checked?: boolean` for boolean consent fields.
- **Phase V note:** Phase V did not touch `schema-field-extensions.ts`.
- **Phase X note:** Phase X did not touch `schema-field-extensions.ts`. The gap remains.
- **Phase Y note:** Phase Y did not touch `schema-field-extensions.ts`. The gap remains.
- **Target:** Phase Z or first `schema-field-extensions.ts` touch.

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
- **Target:** Phase Z or first `SchemaFormRenderer.tsx` touch.

### RISK-A11Y-U02 — `CheckboxControl`, `FontPickerControl`, `ColorSchemeControl` use ternary `aria-describedby` — drops `helpText` when error present — [LOW]
- **Status:** OPEN · a11y inconsistency; deferred past Phase V.
- **Introduced:** Phase U (2026-07-11).
- **Evidence:** `aria-describedby={error ? `${id}-error` : helpText ? `${id}-help` : undefined}` in `CheckboxControl.tsx`, `FontPickerControl.tsx`, `ColorSchemeControl.tsx`. When both an error and `helpText` are present, only the error id is linked; the `helpText` span is rendered in the DOM but not programmatically associated. `HtmlControl`, `LiquidControl`, `VideoUrlControl`, and `ResourcePickerControl` correctly use the array-filter-join pattern: `[error ? `${id}-error` : null, helpText ? `${id}-help` : null].filter(Boolean).join(' ') || undefined`.
- **Disposition:** Replace the ternary with the array-join pattern in the three affected controls.
- **Phase V note:** Phase V did not touch any Phase U control files.
- **Phase X note:** Phase X touched `controls/` (VideoControl.tsx additive patch + controls.module.css new classes). `CheckboxControl.tsx`, `FontPickerControl.tsx`, and `ColorSchemeControl.tsx` were not changed; the gap remains.
- **Phase Y note:** Phase Y added `AppBlockSlotPanel.tsx` and modified `controls.module.css` (additive). `CheckboxControl.tsx`, `FontPickerControl.tsx`, and `ColorSchemeControl.tsx` were not changed; the gap remains.
- **Target:** Phase Z or first `CheckboxControl.tsx`/`FontPickerControl.tsx`/`ColorSchemeControl.tsx` touch.

## Phase U style risks

### RISK-STYLE-U01 — `LiquidControl.tsx` uses raw `fontSize: 12` inline style — [LOW]
- **Status:** OPEN · design token violation; deferred.
- **Introduced:** Phase U (2026-07-11).
- **Evidence:** `apps/merchant-control-plane/src/components/theme-editor/controls/LiquidControl.tsx:68` — `style={{ fontFamily: '"Fira Code", "Consolas", monospace', fontSize: 12 }}`. React resolves `fontSize: 12` to `12px` — a raw pixel value. The `--lb-*` tokens mandate `var(--lb-font-size-caption, 12px)` for this size range.
- **Disposition:** Change `fontSize: 12` to `fontSize: 'var(--lb-font-size-caption, 12px)'`.
- **Phase V note:** Phase V did not touch `LiquidControl.tsx`.
- **Phase X note:** Phase X touched `controls/` but did not touch `LiquidControl.tsx`. The gap remains.
- **Phase Y note:** Phase Y did not touch `LiquidControl.tsx`. The gap remains.
- **Target:** Phase Z or first `LiquidControl.tsx` touch.

### RISK-STYLE-U02 — `controls.module.css` uses raw `px` spacing values — [LOW]
- **Status:** OPEN · design token inconsistency; deferred.
- **Introduced:** Phase U (2026-07-11).
- **Evidence:** `apps/merchant-control-plane/src/components/theme-editor/controls/controls.module.css` — several rules use raw `px` spacing (`gap: 4px`, `padding: 3px 8px`, `margin-top: 4px`). The design ratchet tests check for `rounded-[Npx]` patterns and `--lb-` token presence; these raw values pass the gate but are inconsistent with the stated `--lb-*` tokens-only rule.
- **Disposition:** Replace literal spacing values with `--lb-*` spacing tokens where they exist (e.g., `var(--lb-space-1)` for 4px, `var(--lb-space-2)` for 8px). Where tokens are absent, document the gap and add the tokens to the design system.
- **Phase V note:** Phase V did not touch `controls.module.css`.
- **Phase X note:** Phase X added new `mediaLibrary*` and `browseLibraryBtn` classes to `controls.module.css`, all using `--lb-*` tokens. Pre-existing raw `px` spacing values (gap: 4px, padding: 3px 8px, margin-top: 4px) in Phase U classes were not changed. The gap for pre-existing classes remains.
- **Phase Y note:** Phase Y added 9 new `appBlock*` classes to `controls.module.css`, all using `--lb-*` tokens. Pre-existing raw `px` spacing values in Phase U classes were not changed. The gap remains.
- **Target:** Phase Z or a dedicated token-cleanup pass over pre-Phase-X `controls.module.css` entries.

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
- **Target:** Phase Z or earliest phase touching `dynamic-source-binding.ts` or `theme-renderer.ts`.

### RISK-W02 — `auth.user.storeId` optional in ES256 tokens — session-bound fast-fail in `verifySiteOwnership` bypassed when absent — [LOW]
- **Status:** OPEN · known residual; deferred.
- **Introduced:** Phase W (2026-07-11).
- **Evidence:** `services/api-gateway/src/lib/auth-user.ts` — `storeId?: string` (optional). The fast-fail inside `verifySiteOwnership` (`if (sessionStoreId && sessionStoreId !== siteId) return false`) is vacuously bypassed when `storeId` is absent from the token — pre-date tokens or internal-SSO flows where the store header is not supplied. The DB ownership check still enforces tenant isolation; no cross-tenant read is possible. However, the stronger of the two controls disappears silently for these token shapes.
- **Why it matters:** The fast-fail prevents even a DB round-trip for cross-tenant access attempts from merchants with well-formed session tokens. Its absence for legacy/internal tokens degrades defence-in-depth without breaking correctness.
- **Disposition:** Add a test case in `resource-search-w.test.ts` proving the route still 403s when `auth.user.storeId` is undefined and the actor does not own the store (DB check still enforced). Long-term: require `storeId` in all ES256 merchant tokens at issuance to make the fast-fail unconditional.
- **Phase X note:** Phase X's media-library route has the same optional-storeId exposure (same `verifySiteOwnership` call pattern). The gap applies to the new route equally. Phase X did not touch the token issuance path.
- **Phase Y note:** Phase Y did not touch `resource-search.ts`, `media-library.ts`, or the token issuance path. The gap remains.
- **Target:** Phase Z or earliest phase touching `resource-search.ts`, `media-library.ts`, or the token issuance path.

### RISK-W03 — `siteDrops` tenant-scoping trust boundary is comment-only; block-level bindings unresolved — [LOW]
- **Status:** OPEN · trust boundary documentation gap + functional gap.
- **Introduced:** Phase W (2026-07-11).
- **Evidence:** `packages/theme-engine/src/theme-renderer.ts` line 393 comment: `// siteDrops is already tenant-scoped by the caller`. No assertion, schema check, or integration test validates that the storefront composition layer (which will populate `siteDrops` in a future phase) actually scopes the map to the current site. In Phase W, `siteDrops` defaults to `{}` so no resources can resolve at all, making this latent rather than active. The trust contract is invisible to a future implementer.
- **Why it matters:** A future Phase X implementer building the storefront `siteDrops` hydration could inadvertently pass an unscoped map, allowing a descriptor's `id` from any site to resolve to a drop from another site.
- **Disposition:** Add a mandatory `siteId` field to `SiteDrops` interface so the resolver can log or assert the scope at development time. Document the per-field scoping requirement in `DYNAMIC_SOURCES_REFERENCE.md`. Create an integration test shell for the composition-to-renderer `siteDrops` pipeline before the storefront hydration service is built.
- **Phase X note:** Phase X did not build the storefront `siteDrops` hydration service; `siteDrops` defaults to `{}` in all Phase X render paths. The trust boundary comment-only gap remains. The Phase X media-library route supplies URLs (not resource drops), so it does not feed `siteDrops`.
- **Phase Y note:** Phase Y did not build the storefront `siteDrops` hydration service. The trust boundary comment-only gap remains.
- **Target:** Phase Z or the phase that builds the storefront `siteDrops` hydration service.

### RISK-W04 — `ArrowUp` key handler in `ResourcePickerControl` selects item 0 when no item is selected — [LOW]
- **Status:** OPEN · WAI-ARIA 1.2 combobox non-conformance; deferred.
- **Introduced:** Phase W (2026-07-11).
- **Evidence:** `apps/merchant-control-plane/src/components/theme-editor/controls/ResourcePickerControl.tsx` — `ArrowUp` handler: `setActiveIndex((prev) => Math.max(prev - 1, 0))`. When `activeIndex` starts at `-1` (no item selected), `Math.max(-1 - 1, 0) = Math.max(-2, 0) = 0`. The first `ArrowUp` press silently selects item 0 before the user has pressed `ArrowDown`. WAI-ARIA 1.2 combobox pattern expects `ArrowUp` from a no-selection state to either do nothing or focus the last item in the list.
- **Why it matters:** Assistive technology users expect `ArrowDown` to be the initial navigation key into a combobox. The `-1→0` snap on `ArrowUp` is unexpected and may confuse screen reader users.
- **Disposition:** Guard the `ArrowUp` handler: `setActiveIndex((prev) => prev <= 0 ? 0 : prev - 1)` at minimum (clamps without the `-2→0` snap). Alternatively, `ArrowUp` from `-1` → set to `results.length - 1` (focus last item), matching the ARIA pattern for list wrap-around.
- **Phase X note:** Phase X did not touch `ResourcePickerControl.tsx`. The gap remains.
- **Phase Y note:** Phase Y did not touch `ResourcePickerControl.tsx`. The gap remains.
- **Target:** Phase Z or first `ResourcePickerControl.tsx` touch.

### RISK-W05 — Loading indicator hidden during 300 ms debounce window on first keystroke — [LOW]
- **Status:** OPEN · UX gap; deferred.
- **Introduced:** Phase W (2026-07-11).
- **Evidence:** `apps/merchant-control-plane/src/components/theme-editor/controls/ResourcePickerControl.tsx` — the loading `<li>` spinner is rendered inside `{isOpen ? <ul role="listbox"> … </ul> : null}`. The state transitions to `loading` immediately on each keystroke, but `isOpen` remains `false` until the 300 ms `setTimeout` resolves and results arrive to set `setIsOpen(true)`. On the first keystroke of a fresh session, there is zero visible feedback for the entire debounce window. Subsequent keystrokes (when `isOpen` is already `true` from prior results) do show the spinner.
- **Why it matters:** Merchants who type a single character and pause experience dead silence for 300 ms, then results appear abruptly. This is noticeable on slow connections where the fetch takes additional time after the debounce fires.
- **Disposition:** Set `setIsOpen(true)` immediately when the query becomes non-empty (before the `setTimeout`), so the `{isOpen?…}` conditional is satisfied and the loading `<li>` is visible during the debounce window. The empty-query early-return already calls `setIsOpen(false)`, so the close-on-clear behavior is unaffected.
- **Phase X note:** Phase X did not touch `ResourcePickerControl.tsx`. The gap remains.
- **Phase Y note:** Phase Y did not touch `ResourcePickerControl.tsx`. The gap remains.
- **Target:** Phase Z or first `ResourcePickerControl.tsx` touch.

### RISK-W06 — Block-level settings not resolved through `resolveDynamicSourceDescriptors` — [LOW]
- **Status:** OPEN · functional gap; CONFIRMED by code review.
- **Introduced:** Phase W (2026-07-11).
- **Evidence:** `packages/theme-engine/src/theme-renderer.ts` — `resolveDynamicSourceDescriptors` is called on section-level `templateSection.settings` (line ~395) but is NOT called on block-level `block.settings` anywhere inside `renderLiquidSectionBlocks` (line ~755). Block settings (`block.settings`) are passed unchanged to `buildLiquidScope` and to the returned `LiquidRenderedBlock.settings`. A `ResourceBinding` descriptor stored as a block setting (rather than a section setting) will reach Liquid as the raw object `{ __lb_binding: true, source: 'resource', resourceType: 'product', id: '...' }` and render as `[object Object]` or an empty string via LiquidJS coercion.
- **Why it matters:** Phase W's primary user-visible value is the resource picker. If a merchant picks a product for a block-level field (e.g., a carousel block with a `featured_product` field), the pick will store correctly in the section's `settings.blocks[id].settings.featured_product`, but the storefront will not resolve it to a drop — the block template will receive the raw descriptor instead.
- **Disposition:** Apply `resolveDynamicSourceDescriptors(block.settings, siteDrops)` at the top of the per-block render loop inside `renderLiquidSectionBlocks`, mirroring the section-level resolution pattern. This is a one-function-call addition at the correct call site; no structural changes required.
- **Related:** See also RISK-T03 (block settings bypass `filterBlockedSettingsKeys`) — fixing RISK-W06 simultaneously provides the defence-in-depth benefit of RISK-T03 for the binding-resolution path.
- **Phase X note:** Phase X did not touch `theme-renderer.ts`. The block-level resolution gap remains.
- **Phase Y note:** Phase Y touched `theme-renderer.ts` (minimal — 2 hunks in the `isLiquidAppBlockType` branch only). The block-level binding resolution path at lines ~755+ was not part of Phase Y scope.
- **Target:** Phase Z or first `theme-renderer.ts` touch affecting the block-level settings path.

## Phase Y risks

### RISK-Y01 — `MAX_APP_BLOCKS_PER_SLOT` not enforced in the renderer's block iteration loop — [LOW]
- **Status:** OPEN · defence-in-depth gap; introduced Phase Y (2026-07-11).
- **Introduced:** Phase Y (2026-07-11).
- **Evidence:** `packages/theme-engine/src/app-block-model.ts` — `validateAppBlockReferences` enforces `MAX_APP_BLOCKS_PER_SLOT = 20` at reference-construction / save time. `packages/theme-engine/src/theme-renderer.ts` — `renderLiquidSectionBlocks` iterates `orderedKeys(input.section.blocks, ...)` without tracking the count of `isLiquidAppBlockType` blocks per section. A crafted `input.section.blocks` object with more than 20 `@app` entries would render all of them without hitting a render-time cap.
- **Why it matters:** Validation-layer enforcement (at save time) is the primary control. The render boundary lacks the corresponding defence-in-depth count cap. In the current architecture all bundle data flows through `LiquidThemePackageBundleSchema.parse` before storage, so exploitation requires bypassing the bundle schema (which enforces `superRefine` structural checks). The missing render-time cap is a defence-in-depth gap, not a directly exploitable path.
- **Disposition:** Fix: in the `isLiquidAppBlockType` branch of `renderLiquidSectionBlocks`, maintain an `appBlockCount` counter per section. When `appBlockCount > MAX_APP_BLOCKS_PER_SLOT`, emit `APP_BLOCK_ERROR_PLACEHOLDER_CLASS` and `continue` (matching the crash-isolation pattern) instead of resolving the block. Import `MAX_APP_BLOCKS_PER_SLOT` from `./app-block-model` (already imported in Phase Y for `APP_BLOCK_ERROR_PLACEHOLDER_CLASS`). Add a test asserting that block 21 produces an error-placeholder and blocks 1–20 render normally.
- **Target:** Phase Z or earliest phase touching `theme-renderer.ts`.
