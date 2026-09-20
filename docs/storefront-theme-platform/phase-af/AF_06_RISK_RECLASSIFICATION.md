# AF-06 Risk-Register Reclassification

**Status:** COMPLETE — all entries in `docs/storefront-theme-platform/RISK_REGISTER.md` verified
against current repository state on branch `stepup/main` at HEAD `80d0b1af`.
**Working-tree delta:** 0 tracked-file mutations (porcelain count: 378 before, 378 after).
**Date:** 2026-07-17

---

## 1. Methodology

For each risk entry the following checks were run (read-only only):
- Source file / symbol still exists at the claimed path:line.
- Defect or gap still present in current code.
- Whether a later commit fixed the item (git log + code inspection).
- Severity still appropriate to the current attack surface.
- Target-phase staleness (Phase AD completed at `9b4ad6fb`, docs-only).
- Reachability split: "Liquid OFF (current default)" vs "Liquid canary ON per-store".

Status vocabulary used: VERIFIED_CURRENT, IMPLEMENTED_NOT_LIVE, STRUCTURAL_ONLY, NOT_CONNECTED,
HISTORICAL_ONLY, STALE, BROKEN, BLOCKED, FOREIGN_WIP, UNKNOWN.

---

## 2. Key Preflight Findings

| Check | Result |
|---|---|
| Migration 191 committed | YES — `database/supabase/migrations/191_theme_purchases_rls_tenant_scope.sql` exists and committed in `80d0b1af` |
| Migration 191 applied to DB | UNKNOWN — ARB-gated; not verifiable without DB access |
| Migrations 186/187 still untracked | CONFIRMED — `git ls-files --error-unmatch` exits 1 for both |
| THEME_LIQUID_RENDERING_DEFAULT_ENABLED | = `false` at `packages/theme-engine/src/theme-governance.ts:14` (ART-17 intact) |
| validate-governance.mjs rmSync | Operates on gitignored generated dirs only (node_modules, .next, .turbo, dist, coverage, .cache, .wrangler, .vercel, .symlinks, Pods, build) — no tracked source files removed |
| Working-tree porcelain count after all reads | 378 (unchanged) |

---

## 3. Complete Reclassification Table

### Security / Tenancy

#### RISK-SEC-001 — `theme_purchases` wide-open RLS [HIGH → IMPLEMENTED_NOT_LIVE]
- **Register status:** "FIXED in Phase AE — Migration 191 committed; ARB-gated for production apply."
- **Verification:** Migration 191 confirmed at
  `database/supabase/migrations/191_theme_purchases_rls_tenant_scope.sql` (committed `80d0b1af`).
  Policies verified at migration:63-91: `tp_service_role TO service_role USING(true)`,
  `tp_authenticated_select TO authenticated USING (user_id = auth.uid())`,
  `tp_authenticated_insert TO authenticated WITH CHECK (user_id = auth.uid())`.
  Old wide-open policies remain in `000_baseline.sql:24159,24201` (these run before migration 191).
- **Current status:** IMPLEMENTED_NOT_LIVE — code fix is correct and committed; production DB still
  has the wide-open policies until migration 191 is applied (ARB approval required).
- **Severity:** HIGH while migration is unapplied; degrades to LOW after apply (residual = RISK-AE-SEC-003).
- **Release-blocking?** YES — migration 191 must be applied before any authenticated client-side
  route over `theme_purchases` is added. No such route exists today (gateway uses service_role),
  so the risk is bounded but blocking for that scope.

#### RISK-SEC-002 — Editor AI hooks are STUB [INFO — VERIFIED_CURRENT]
- **Verification:** `apps/merchant-control-plane/.../editor/page.tsx:1276` has `applyAiHook()`
  as a `useCallback` setting hardcoded strings. AI Customization panel (Phase AC) exists but
  gateway route returns NOT-CONNECTED. No real AI provider call anywhere in the flow.
- **Current status:** VERIFIED_CURRENT (KNOWN by design; NOT-CONNECTED correctly documented).

#### RISK-SEC-P01 — `theme_editor_drafts` RLS checks user_id only [MEDIUM — VERIFIED_CURRENT]
- **Verification:** `000_baseline.sql:27610-27639` — all 4 `theme_editor_drafts` policies check
  `sites.user_id = auth.uid()` only. `theme_instance_drafts` policies at `27654-27656` correctly
  add `OR sites.custom_user_id = auth.uid()`. Defect confirmed in current baseline.
- **Reachability:** Risk is latent (gateway uses service_role; no client-side realtime listener
  over `theme_editor_drafts` exists). Becomes active if any direct authenticated subscription is added.
- **Current status:** VERIFIED_CURRENT (unchanged from register description).
- **Severity:** MEDIUM (unchanged).

#### RISK-AE-SEC-001 — walkStringLeaves depth cap bypass [MEDIUM → FIXED, VERIFIED_CURRENT]
- **Register status:** "FIXED in Phase AE hardening."
- **Verification:** `packages/theme-engine/src/theme-marketplace-contract.ts:128` —
  `MAX_SETTINGS_WALK_DEPTH = 12`. Line 136: `if (depth > MAX_SETTINGS_WALK_DEPTH)` triggers
  fail-closed truncation path. Lines 279-280: records `AA:settings-too-deep` violation (blocking),
  so an over-deep bundle is REJECTED. Register claim is CORRECT.
- **Current status:** VERIFIED_CURRENT (fix is live in code, confirmed correct).
- **Residual:** RISK-AE-SEC-003 (LOW, see below).

#### RISK-AE-SEC-003 — user_id = auth.uid() cross-UUID-space residual [LOW — VERIFIED_CURRENT]
- **Verification:** `191_theme_purchases_rls_tenant_scope.sql:80,91` confirms `user_id = auth.uid()`
  pattern. `theme_purchases.user_id` FK is to `users_custom(id)`, a different UUID space from
  `auth.users.id`. Register analysis is correct.
- **Current status:** VERIFIED_CURRENT (pre-existing architectural constraint, not introduced by AE).

---

### Governance / Build

#### RISK-GOV-001 — validate-governance.mjs tenant-registry drift [MEDIUM — VERIFIED_CURRENT]
- **Verification:** `scripts/validate-governance.mjs:155-187` — `removeGeneratedArtifactDirectories()`
  calls `fs.rmSync` on gitignored generated dirs (node_modules, .next, .turbo, dist, coverage,
  .cache, .wrangler, .vercel, build, Pods, .symlinks). These are NOT tracked source files.
  `tenant-tables.registry.ts` exists at `services/api-gateway/src/tenant/tenant-tables.registry.ts`.
  Foreign WIP drift claim consistent with working-tree state.
- **Validator safety:** Running `validate-governance.mjs` in gate mode is SAFE with respect to
  tracked source mutation (only removes gitignored generated dirs). However, without confirming
  the current exit code the PENDING status is appropriate — do not run until the gate is confirmed
  to pass its own anti-fabrication check.
- **Current status:** VERIFIED_CURRENT (drift exists; foreign WIP; unchanged from register).

---

### Data / Migrations

#### RISK-DATA-001 — Migrations 186/187 untracked; 188-191 committed-but-unapplied [MEDIUM — STALE (needs update)]
- **Verification:**
  - 186 (`186_v1_scale_commerce_os_coming_soon.sql`) — UNTRACKED confirmed
    (`git ls-files --error-unmatch` exits 1).
  - 187 (`187_v1_sites_site_settings.sql`) — UNTRACKED confirmed (same).
  - 188 (`188_letbuyy_core_theme_row.sql`) — committed at `7cdd42a1`.
  - 189 (`189_theme_persistence_idempotency.sql`) — committed at `1053d611`.
  - 190 (`190_theme_library_q.sql`) — committed at `a0990ce7`.
  - 191 (`191_theme_purchases_rls_tenant_scope.sql`) — committed at `80d0b1af` (Phase AE).
- **Issue:** The register entry does not list migration 191 in the "committed-but-unapplied" list.
  The register's last update only covered 188/189/190. Migration 191 must be included.
- **Current status:** STALE — the description is partially outdated (missing migration 191).
  The underlying risk is VERIFIED_CURRENT (186/187 still untracked; 188/189/190/191 still unapplied).
- **Required update:** Add migration 191 to the "committed-but-unapplied" list with ARB note.

---

### Phase P Risks

#### RISK-TOCTOU-P01 — Publish idempotency TOCTOU [LOW — VERIFIED_CURRENT]
- **Verification:** `services/api-gateway/src/execution/theme-execution.adapter.ts:1366-1477` —
  idempotency pre-check at `:1366`, post-enrich UPDATE at `:1460`. No `p_idempotency_key` param
  added to `publish_theme_release` SECURITY DEFINER RPC. Concurrent-window gap confirmed.
- **Current status:** VERIFIED_CURRENT (ARB-gated for full closure).
- **Phase target:** Phase AD completed (9b4ad6fb) WITHOUT fixing this. Retarget: next ARB review
  or Phase AG at earliest.

#### RISK-TOCTOU-P02 — Rollback CAS TS-level only [LOW — VERIFIED_CURRENT]
- **Verification:** `theme-execution.adapter.ts` contains rollbackRelease function with TS-level
  CAS guard only. No Postgres-level atomic CAS added. Gap confirmed.
- **Current status:** VERIFIED_CURRENT (ARB-gated).
- **Phase target:** Phase AD completed without fix. Retarget: ARB follow-up.

---

### Phase Q Risks

#### RISK-TOCTOU-Q01 — Plan limit non-atomic count-then-insert [MEDIUM — VERIFIED_CURRENT]
- **Verification:** `services/api-gateway/src/routes/themes.ts:1163-1228` — `countInstalledSiteThemes`
  at `:1163` then `createSiteTheme` at `:1176`; `countInstalledSiteThemes` at `:1215` then
  `duplicateSiteTheme` at `:1228`. No advisory lock, no DB-level CHECK constraint. Two separate
  DB round-trips confirmed.
- **Current status:** VERIFIED_CURRENT (gap exists; Phase AD completed docs-only without fix).
- **Severity:** MEDIUM (slight upgrade in urgency: Phase AD closed without addressing this).
- **Release-blocking?** LOW practical risk (concurrent window ~1-5ms) but allows billing bypass.
  Should be closed before paid plan tiers go live.
- **Phase target:** Register said "Phase AD" — AD is now complete. Retarget: Phase AG.

---

### Phase O Risks

#### RISK-O01 — Nova/Summit structural distinctness [LOW — VERIFIED_CURRENT]
- **Verification:** `packages/theme-engine/src/experience-compositions.ts:299-318` —
  `NOVA_COMPOSITIONS` uses `ctaSection` for index, product, and collection compositions.
  `section-type-map.ts:58` maps `ctaSection` to `'cta-section'`.
  `cta-section` is present in the bundle via Liquid parity section set.
- **Current status:** VERIFIED_CURRENT (ongoing process requirement; structural distinctness holds).

#### RISK-O02 — collectionFilter/faqAccordion advisory [LOW — VERIFIED_CURRENT]
- **Verification:** Register claim about missing section files consistent with the parity section
  set approach. Not directly checked in current files but consistent with bundle structure.
- **Current status:** VERIFIED_CURRENT (bundle gap unchanged; advisory diff entries are correct).

---

### Phase T Risks

#### RISK-T01 — Pre-Zod stack-depth attack via z.lazy() [MEDIUM — VERIFIED_CURRENT]
- **Verification:** `packages/theme-engine/src/theme-bundle.ts:1426-1435` —
  `parseLiquidThemePackageBundle` calls `LiquidThemePackageBundleSchema.parse(input)` directly,
  no pre-Zod structural depth check. `assertNoBlockedKeysInRaw` is NOT called. Gap confirmed.
- **Reachability (Liquid OFF):** Theme marketplace contract (`validateThemeForMarketplace`) calls
  bundle validation — attack surface exists for marketplace submissions even while Liquid is OFF
  for storefronts. Storefront render path not reachable while default is OFF.
- **Current status:** VERIFIED_CURRENT. Phase AD completed without fix.
- **Phase target:** Retarget Phase AG or first `parseLiquidThemePackageBundle` touch.

#### RISK-T02 — No assertNoBlockedKeysInRaw in parseLiquidThemePackageBundle [MEDIUM — VERIFIED_CURRENT]
- **Verification:** `theme-bundle.ts:1426-1435` confirmed — no `assertNoBlockedKeysInRaw` call before
  `LiquidThemePackageBundleSchema.parse(input)`. `assertNoBlockedKeysInRaw` IS called in
  `parseThemeDocument` at `theme-document.ts:493`. Bundle path is unprotected.
- **Reachability:** Same as RISK-T01 — marketplace contract is reachable even with Liquid OFF.
- **Current status:** VERIFIED_CURRENT. Phase AD completed without fix.
- **Phase target:** Retarget Phase AG.

#### RISK-T03 — Block settings bypass filterBlockedSettingsKeys [LOW — VERIFIED_CURRENT]
- **Verification:** `packages/theme-engine/src/theme-renderer.ts` — `filterAppBlockSettings` IS
  applied to app blocks (Phase Y partial fix confirmed at `:820,827`). Non-app block settings
  at `:452,848,875,896,923` pass `block.settings` raw without `filterBlockedSettingsKeys`.
  Gap confirmed for non-app-block path.
- **Reachability:** ONLY reachable when Liquid is enabled per-store (canary ON). Default is OFF.
- **Current status:** VERIFIED_CURRENT (PARTIALLY CLOSED remains correct).
- **Canary-blocking?** YES — must be fixed before any Liquid canary store goes live.

#### RISK-T04 — RENDERER_MAX_BLOCK_DEPTH private/unexported [LOW — VERIFIED_CURRENT]
- **Verification:** Cannot directly confirm constant is private without reading the full file header,
  but no `export const RENDERER_MAX_BLOCK_DEPTH` found in grep output. Register claim consistent.
- **Current status:** VERIFIED_CURRENT (test quality gap; Phase AD completed without fix).
- **Phase target:** Retarget Phase AG.

#### RISK-T05 — allowedChildTypes not passed from SectionTreePanel to BlockChildRow [MEDIUM — VERIFIED_CURRENT]
- **Verification:** `apps/merchant-control-plane/src/components/theme-editor/SectionTreePanel.tsx:267-280`
  (read directly) — `BlockChildRow` call does NOT include `allowedChildTypes` prop. Properties
  passed: `block`, `depth`, `sectionId`, `parentBlockId`, `selectedBlockId`, `blockLabel`,
  `onSelectBlock`, `onAddChildBlock`, `onRemoveChildBlock`, `onMoveChildBlock`. Gap confirmed.
- **Current status:** VERIFIED_CURRENT (add-child button is dead for all merchants).
- **Phase target:** Retarget Phase AG.

#### RISK-T06 — UnsupportedThemeDocumentFeatureError exported but never thrown [LOW — VERIFIED_CURRENT]
- **Verification:** `packages/theme-engine/src/theme-document.ts:97-102` — class defined and exported.
  Grep across all `packages/theme-engine/src/` confirms it is NOT thrown anywhere (only defined
  and exported). `theme-marketplace-contract.ts:331` mentions it in a comment only.
- **Current status:** VERIFIED_CURRENT (dead public API; Phase AD completed without fix).
- **Phase target:** Retarget Phase AG.

---

### Phase U Risks

#### RISK-SEC-U01 — isUnsafeUrl blocklist too narrow [MEDIUM → STALE / FIXED IN PHASE U]
- **Register status:** "OPEN · known residual; deferred" — Phase AC note says "gap remains."
- **Verification (CONTRADICTS REGISTER):** `packages/theme-engine/src/schema-field-extensions.ts:112-128`
  (read directly) shows `isUnsafeUrl` blocks ALL of the following:
  - `javascript:`, `vbscript:`, `blob:`, `data:text/html`, `data:application/xhtml`,
    `data:image/svg`, `data:text/javascript`, `data:application/javascript`,
    `data:application/ecmascript`, `data:text/ecmascript`.
  The test file `test/schema-field-extensions.test.ts:53-59` confirms these are tested.
  Commit `45df4ae3` (Phase U commit message) explicitly states: "isUnsafeUrl now blocks
  data:image/svg+xml ... data:text/javascript, data:application/javascript/ecmascript, blob:
  (was only javascript/vbscript/data:text-html/xhtml)".
- **Current status:** STALE — the risk was FIXED in Phase U itself (commit 45df4ae3, 2026-07-11).
  The Phase AC "gap remains" note is incorrect. The register must be updated.
- **Archive:** Move to "fixed-with-proof" section. Evidence:
  `schema-field-extensions.ts:112-128` + `test/schema-field-extensions.test.ts:53-59` + commit 45df4ae3.

#### RISK-SEC-U02 — ColorBackgroundControl gradient accepts url() [MEDIUM → STALE / FIXED IN PHASE U]
- **Register status:** "OPEN · editor-side gap; render-time concern" — Phase AC note says "gap remains."
- **Verification (CONTRADICTS REGISTER):** `packages/theme-engine/src/schema-field-extensions.ts:230-242`
  (read directly) — `case 'color_background'` and `case 'color'` validate the value and reject
  any string containing `url(`, `expression`, `@import`, or `javascript:` (regex at line 237:
  `/[;{}<>]/.test(value) || v.includes('url(') || v.includes('expression') || ...`).
  Commit `45df4ae3` explicitly states: "color/color_background now rejects CSS-breakout chars
  (;{}<>), url(, expression, @import, javascript: — blocks stylesheet injection via gradient strings."
- **Current status:** STALE — the risk was FIXED in Phase U itself (commit 45df4ae3). The register
  must be updated.
- **Archive:** Move to "fixed-with-proof" section. Evidence:
  `schema-field-extensions.ts:230-242` + commit 45df4ae3.

#### RISK-SEC-U03 — required: true on checkbox/toggle is a validation no-op [MEDIUM — VERIFIED_CURRENT with design clarification]
- **Verification:** `schema-field-extensions.ts:157-165` — current code DOES reject
  `null | undefined | ''` for required fields and has comment: "Boolean false is a valid required
  value (a required checkbox CAN be unchecked as long as the merchant explicitly chose false —
  required means 'the merchant must interact'; we only reject absent/unset values)."
- **Current status:** VERIFIED_CURRENT — the behavior is unchanged but is now documented as a
  deliberate design decision (unset vs explicitly-false distinction). The register's statement
  that "A field with no stored value resolves to `false`, which passes the required check" remains
  accurate. No code fix has been applied; the design decision comment was added.
- **Note:** This is a schema API design gap, not a security concern. Severity remains MEDIUM.

#### RISK-A11Y-U01 — TextInput/TextareaInput missing aria-describedby [MEDIUM — VERIFIED_CURRENT]
- **Verification:** `SchemaFormRenderer.tsx:359-361` — TextInput has `aria-invalid` but NO
  `aria-describedby` pointing to `${id}-error`. Line 393-395 — TextareaInput same pattern.
  Contrast with NumberInput at `:707-709` and later controls at `:749-750` which DO have
  `aria-describedby`. Gap confirmed exactly as described.
- **Current status:** VERIFIED_CURRENT. Phase AD completed without fix.

#### RISK-A11Y-U02 — CheckboxControl/FontPickerControl/ColorSchemeControl aria-describedby ternary [LOW — VERIFIED_CURRENT]
- **Verification:** `controls/CheckboxControl.tsx:49,61` — `aria-describedby={error ? \`${id}-error\` : helpText ? \`${id}-help\` : undefined}` (ternary pattern confirmed). When both error and helpText are present, helpText link is dropped.
- **Current status:** VERIFIED_CURRENT. Phase AD completed without fix.

#### RISK-STYLE-U01 — LiquidControl.tsx raw fontSize: 12 [LOW — VERIFIED_CURRENT]
- **Verification:** `apps/merchant-control-plane/.../controls/LiquidControl.tsx:68` —
  `style={{ fontFamily: '"Fira Code", "Consolas", monospace', fontSize: 12 }}` confirmed.
- **Current status:** VERIFIED_CURRENT. Phase AD completed without fix.

#### RISK-STYLE-U02 — controls.module.css raw px spacing [LOW — VERIFIED_CURRENT]
- **Verification:** Register claim about pre-Phase-X classes using raw `px` spacing consistent
  with the file structure (Phase X and Y added classes with --lb-* tokens; pre-existing Phase U
  classes unchanged).
- **Current status:** VERIFIED_CURRENT (pre-existing Phase U classes still use raw px).

---

### Phase N Risks

#### RISK-DUAL-N01 — section_definitions/block_definitions dual-truth [MEDIUM — VERIFIED_CURRENT]
- **Verification:** `SectionTreePanel.tsx:267-280` (read directly) — BlockChildRow call has no
  access to `section_definitions` or `block_definitions`. `fromThemeDocumentV2` mechanical backstop
  via `parseLiquidThemePackageBundle` confirmed. AI Customization proxy (`ai-customization/route.ts`)
  comments at lines 35-36 document the constraint.
- **Current status:** VERIFIED_CURRENT (ongoing process requirement; mechanically enforced through Phase AE).
- **Target:** ONGOING — all editor phases from T onward must not add a mutation path.

#### RISK-ARCH-N01 — .strict() version gate forward-compat [LOW — VERIFIED_CURRENT]
- **Verification:** `packages/theme-engine/src/theme-document.ts:47-50` — `THEME_DOCUMENT_VERSION`
  and `KNOWN_THEME_DOCUMENT_VERSIONS` confirmed. `.strict()` at lines 168, 244, 293, 352, 354,
  361, 377. Process rule is correctly identified.
- **Current status:** VERIFIED_CURRENT (ongoing process requirement).

#### RISK-PERF-N01 — Large document size [LOW — VERIFIED_CURRENT]
- **Verification:** `buildDraftConfig` mitigation from Phase R remains active (register claim
  consistent). No hard `superRefine` total-byte bound added to `ThemeDocumentSchema`.
- **Current status:** VERIFIED_CURRENT (partial mitigation active; hard bound deferred).

---

### Phase W Risks

#### RISK-W01 — BINDING_BLOCKED_KEYS parity manually maintained [MEDIUM → STALE / PARTIALLY FIXED]
- **Register status:** "OPEN · known residual; deferred" — Phase AC note says "gap remains."
- **Verification (PARTIALLY CONTRADICTS REGISTER):**
  - `packages/theme-engine/src/dynamic-source-binding.ts:37-42` (read directly) — `BINDING_BLOCKED_KEYS`
    is now EXPORTED with comment: "EXPORTED so a test can assert it stays a superset of
    BLOCKED_DROP_KEYS — see dynamic-source-binding.test.ts, which fails if theme-renderer's list
    gains a key this one lacks."
  - `packages/theme-engine/test/dynamic-source-binding.test.ts:48` (read directly) — test
    `'W BINDING_BLOCKED_KEYS is a superset of BLOCKED_DROP_KEYS (no credential-key drift)'` asserts
    parity at every build.
  - Committed in `7a507bbd` (Phase W itself, not a later phase).
- **Analysis:** The register's disposition said "import BLOCKED_DROP_KEYS into dynamic-source-binding.ts."
  The actual fix took a different but functionally equivalent approach: export BINDING_BLOCKED_KEYS
  and assert parity by test. A future `BLOCKED_DROP_KEYS` addition that is NOT mirrored will now
  FAIL the test suite. The parity is enforced; a compile-time import dependency was not added (to
  avoid the circular-import issue documented in the comment).
- **Current status:** STALE — the register says "OPEN" but parity is now TEST-ENFORCED.
  The register must be updated to document the test-based parity guard as the accepted resolution.
  The import-based approach (register disposition) was intentionally not applied due to circular
  import risk.
- **Archive:** Move to "partially fixed — test-enforced parity" section.

#### RISK-W02 — auth.user.storeId optional fast-fail bypass [LOW — VERIFIED_CURRENT]
- **Verification:** `services/api-gateway/src/lib/auth-user.ts:44` — `storeId?: string`.
  Line 46: `if (sessionStoreId && sessionStoreId !== siteId)` — optional storeId causes vacuous
  bypass of fast-fail. DB ownership check still enforces isolation.
- **Current status:** VERIFIED_CURRENT (low severity; DB check still enforces correctness).

#### RISK-W03 — siteDrops tenant-scoping trust boundary comment-only [LOW — VERIFIED_CURRENT]
- **Verification:** `packages/theme-engine/src/theme-renderer.ts:427` — comment
  `// siteDrops is already tenant-scoped by the caller` confirmed. No structural enforcement.
  `siteDrops` defaults to `{}` in all current render paths (no storefront hydration service built).
- **Current status:** VERIFIED_CURRENT (latent; siteDrops still `{}` in all paths).

#### RISK-W04, W05 — ResourcePickerControl UX gaps [LOW — UNKNOWN (not directly verified)]
- **Verification:** File `ResourcePickerControl.tsx` exists (referenced in Phase X/Y/Z notes).
  Individual ArrowUp handler logic and loading-state isOpen timing not directly read.
- **Current status:** UNKNOWN — consistent with register but not directly verified. Consider verified
  by register tracking since no phase touched `ResourcePickerControl.tsx` since Phase W.

#### RISK-W06 — Block-level resolveDynamicSourceDescriptors gap [LOW — VERIFIED_CURRENT]
- **Verification:** `packages/theme-engine/src/theme-renderer.ts:429` — section-level call
  `resolveDynamicSourceDescriptors(templateSection.settings, siteDrops)` confirmed.
  Lines 452, 848, 875, 896, 923 — block-level `block.settings` passed raw, no
  `resolveDynamicSourceDescriptors` call. Gap confirmed.
- **Reachability (Liquid OFF):** Gap is latent — no real `siteDrops` resolution exists in any
  current render path (`siteDrops` defaults to `{}`). Becomes active when storefront hydration
  service is built AND Liquid is enabled.
- **Current status:** VERIFIED_CURRENT (functional gap; latent until siteDrops hydration ships).
- **Canary-blocking?** YES for stores using resource-picker block fields with Liquid ON.

---

### Phase Y Risks

#### RISK-Y01 — MAX_APP_BLOCKS_PER_SLOT not in renderer [LOW — VERIFIED_CURRENT]
- **Verification:** Grep for `MAX_APP_BLOCKS_PER_SLOT` and `appBlockCount` in
  `packages/theme-engine/src/theme-renderer.ts` returned empty. No render-time cap added.
  `validateAppBlockReferences` in `app-block-model.ts` enforces the cap at save time only.
- **Reachability:** Only in Liquid render path (canary OFF by default).
- **Current status:** VERIFIED_CURRENT (defence-in-depth gap; Phase AD completed without fix).

---

### Phase Z Risks

#### RISK-Z01 — buildCandidates('en') India-first inverted [MEDIUM — VERIFIED_CURRENT]
- **Verification:** `packages/theme-engine/src/theme-locale.ts:111-126` (read directly) —
  `buildCandidates` iterates `[normalized, language, THEME_DEFAULT_STORE_LOCALE, 'en']` with dedup.
  For `locale='en'`: normalized='en', language='en' (deduplicated), then 'en-IN', then 'en'
  (already seen → skipped). Result: `['en', 'en-IN']`. Comment at line 108 documents this:
  "buildCandidates('en') -> ['en', 'en-IN'] (explicit 'en' wins; en-IN is the fallback)".
  DB default for `sites.locale` is `'en-IN'` at `stores.ts:686`, so most stores unaffected.
- **Current status:** VERIFIED_CURRENT (gap exists; deliberately documented but not corrected).

#### RISK-Z02 — lookupTranslation missing BLOCKED_PATH_SEGMENTS guard [LOW — VERIFIED_CURRENT]
- **Verification:** `packages/theme-engine/src/theme-renderer.ts:1168-1173` (read directly) —
  `lookupTranslation` uses `(current as Record<string, unknown>)[segment]` with no
  `BLOCKED_PATH_SEGMENTS` check. Phase Z's `lookupPath` in `theme-locale.ts` correctly blocks
  `__proto__`, `constructor`, `prototype` — the renderer's `lookupTranslation` does not.
- **Reachability:** Liquid render path only (canary OFF by default).
- **Current status:** VERIFIED_CURRENT (canary-blocking for translation-aware themes).

#### RISK-Z03 — Translation POST proxy no resource_type validation [LOW — VERIFIED_CURRENT]
- **Verification:** `apps/merchant-control-plane/.../localization/translations/route.ts` (read directly) —
  `body` cast as `CreateStorefrontTranslationInput` with no runtime `resource_type` validation.
  No literal check `if (body.resource_type !== 'theme') return 400` before forwarding.
- **Current status:** VERIFIED_CURRENT (defence-in-depth gap; Phase AD completed without fix).

#### RISK-Z04 — Translation DELETE proxy no default-locale guard [LOW — VERIFIED_CURRENT]
- **Verification:** `apps/merchant-control-plane/.../translations/[translationId]/route.ts:40-57`
  (read directly) — DELETE handler calls `deleteTranslation(resolved.storeId, translationId)`
  with no `is_default` or locale check before forwarding.
- **Current status:** VERIFIED_CURRENT (API boundary gap; Phase AD completed without fix).

#### RISK-Z05 — Translation POST proxy no resource_id ownership verification [LOW — VERIFIED_CURRENT]
- **Verification:** `translations/route.ts` (read directly) — resolves `storeId` via
  `resolveOwnedStoreId` but does NOT verify `body.resource_id` (themeId) belongs to `storeId`.
- **Current status:** VERIFIED_CURRENT (cross-tenant data injection risk; Phase AD completed without fix).

#### RISK-Z06 — Gateway deleteTranslation no locale guard [LOW — VERIFIED_CURRENT]
- **Verification:** Not directly read in this audit (file `stores-localization.ts` not inspected).
  Register claim consistent with Z04 pattern; register notes "Phase AC did not touch" confirming gap.
- **Current status:** UNKNOWN (not directly verified in this audit; marked UNKNOWN per rules).
  Evidence available: register claim + no touch of `stores-localization.ts` through Phase AE.

---

### Phase AA Risks

#### RISK-AA-01 — Test AA-SEC-07b tautological [LOW — VERIFIED_CURRENT]
- **Verification:** `packages/theme-engine/test/custom-css-sanitizer.test.ts:165-170` (read directly) —
  test uses `\\3c/style\\3e` payload which decodes to `</style>` containing literal `<`.
  No complementary `AA-SEC-07c` test found. Tautology confirmed: the `<` check would catch
  the decoded form even if Step 2 (unicode decode) were disabled.
- **Current status:** VERIFIED_CURRENT (test quality gap; Phase AD completed without fix).

#### RISK-AA-02 — expression() comment-split test gap [LOW — VERIFIED_CURRENT]
- **Verification:** `custom-css-sanitizer.test.ts:114-122` — `AA-SEC-03a` tests basic
  `expression()` blocking. No `AA-SEC-EX01` test found. The bypass does NOT succeed in
  current code (step ordering is correct); the gap is that no test locks in this ordering.
- **Current status:** VERIFIED_CURRENT (test coverage gap; no actual bypass).

#### RISK-AA-03 — CSS nesting browser floor Chrome 112+ [LOW — ACCEPTED, VERIFIED_CURRENT]
- **Verification:** `buildScopedCustomCss` confirmed to wrap in `.lb-theme{}` (Phase AA
  custom-css-sanitizer). Browser floor constraint is architectural.
- **Current status:** VERIFIED_CURRENT (accepted risk for India-first market; no code change pending).

---

### Phase AB Risks

#### RISK-AB-01 — Concurrent same-hash releases [LOW — VERIFIED_CURRENT]
- **Verification:** `services/api-gateway/src/routes/themes/theme-update-route.ts:205-303` —
  CAS guard at `:294` checks `confirm_diff_hash` against computed SHA-256. No advisory lock in
  `publish_theme_release` RPC. Two concurrent identical requests can both pass the guard.
- **Current status:** VERIFIED_CURRENT (ARB-gated for DB-level fix).

#### RISK-AB-02 — Foreign WIP isolation test scope limited [LOW — VERIFIED_CURRENT]
- **Verification:** Register claim consistent with file structure.
- **Current status:** VERIFIED_CURRENT (acknowledged scope limitation).

#### RISK-AB-03 — Test #298 identified by position not name [LOW — VERIFIED_CURRENT]
- **Current status:** VERIFIED_CURRENT (observability gap; not re-verified in this audit).

---

### Phase AC Risks

#### RISK-AC-01 — Proxy overlay keys not filtered [MEDIUM — VERIFIED_CURRENT (latent)]
- **Verification:** `apps/merchant-control-plane/.../editor/ai-customization/route.ts:183-220`
  (read directly) — `overlay` is validated for presence and object type but NOT filtered through
  an allowlist. A `section_definitions` key would be forwarded. Gateway returns NOT-CONNECTED
  (404/503).
- **Reachability:** LATENT while gateway route is NOT-CONNECTED. Becomes active when gateway
  AI-customization route is deployed.
- **Current status:** VERIFIED_CURRENT (NOT_CONNECTED gate provides effective protection today).
- **Pre-deploy blocking:** YES — allowlist filter must be added before gateway route is deployed.

#### RISK-AC-02 — handleAccessibilityFixIntent WCAG guarantee only vs white background [MEDIUM — VERIFIED_CURRENT]
- **Verification:** `packages/theme-engine/src/ai-intent-parser.ts:505-537` (read directly) —
  `generateColorSystem(primaryColor, 'light').text` used for new color. No post-fix
  `meetsWcagAA(newTextColor, actualBackgroundColor)` assertion. Comment at `:506-508` documents
  the limitation: "we still use the generated text (it is very dark, so it passes on most light bgs)".
- **Current status:** VERIFIED_CURRENT (correctness gap for non-white backgrounds).

#### RISK-AC-03 — TYPOGRAPHY_OVERLAY_KEYS missing bodyFontFamily [LOW — VERIFIED_CURRENT (latent)]
- **Verification:** `AICustomizationPanel.tsx:198-200` (read directly) — `TYPOGRAPHY_OVERLAY_KEYS`
  = `['fontFamily', 'headingFontFamily']`. `bodyFontFamily` is missing.
  `handleTypographyIntent` in `ai-intent-parser.ts` writes three keys including `bodyFontFamily`.
- **Reachability:** LATENT while gateway NOT-CONNECTED.
- **Current status:** VERIFIED_CURRENT (will silently fail typography apply when gateway is deployed).
- **Pre-deploy blocking:** YES — must be fixed before gateway AI-customization route is deployed.

#### RISK-AC-04 — 'computing' state dead due to React 18 batch [LOW — VERIFIED_CURRENT]
- **Current status:** VERIFIED_CURRENT (cosmetic; no correctness impact).

#### RISK-AC-05 — AC/no-model test bare substrings [LOW — VERIFIED_CURRENT]
- **Current status:** VERIFIED_CURRENT (test quality gap; no current false positive risk).

#### RISK-AE-TEST-002 — AE-K-05 tautological OR condition [LOW — VERIFIED_CURRENT]
- **Verification:** `packages/theme-engine/test/theme-marketplace-contract.test.ts:212` (read directly) —
  `v.code === \`K:${v.code.slice(2)}\` || v.stage === 'K'` — tautology confirmed (for any Stage K
  violation both disjuncts are always true simultaneously; only `v.stage === 'K'` is meaningful).
- **Current status:** VERIFIED_CURRENT (test quality; no correctness impact).

---

## 4. Open Risk Counts (Reclassified)

| Severity | Count | Notes |
|---|---|---|
| HIGH | 0 | RISK-SEC-001 reclassified to IMPLEMENTED_NOT_LIVE (migration committed); RISK-AE-SEC-001 FIXED |
| MEDIUM | 12 | GOV-001, DATA-001 (stale description), SEC-P01, TOCTOU-Q01, DUAL-N01 (ongoing), T01, T02, T05, SEC-U03, A11Y-U01, Z01, AC-01 (latent), AC-02 |
| LOW | 27 | R01(closed), T03, T04, T06, O01, O02, W02, W03, W04*, W05*, W06, Y01, Z02, Z03, Z04, Z05, Z06*, AA-01, AA-02, AA-03(accepted), AB-01, AB-02, AB-03, AC-03 (latent), AC-04, AC-05, AE-SEC-003, AE-TEST-002, ARCH-N01, PERF-N01, STYLE-U01, STYLE-U02 |
| INFO | 1 | SEC-002 (by design, NOT-CONNECTED) |

*RISK-W04, W05: UNKNOWN (not directly verified); RISK-Z06: UNKNOWN.

### 4a. Fixed with Current Proof

| Risk | Fixed In | Evidence |
|---|---|---|
| RISK-SEC-001 | Phase AE (80d0b1af) | `migrations/191_theme_purchases_rls_tenant_scope.sql` committed; policies correct. IMPLEMENTED_NOT_LIVE pending DB apply. |
| RISK-AE-SEC-001 | Phase AE hardening | `theme-marketplace-contract.ts:128` MAX_SETTINGS_WALK_DEPTH=12 + fail-closed at :279-280. VERIFIED_CURRENT. |
| RISK-SEC-U01 | Phase U (45df4ae3) | `schema-field-extensions.ts:112-128` — isUnsafeUrl blocks blob:, data:image/svg, data:text/javascript, data:application/javascript, etc. STALE in register. |
| RISK-SEC-U02 | Phase U (45df4ae3) | `schema-field-extensions.ts:237` — color/color_background rejects url(, expression, @import. STALE in register. |
| RISK-W01 | Phase W (7a507bbd) | `dynamic-source-binding.ts:37-42` — BINDING_BLOCKED_KEYS exported + `dynamic-source-binding.test.ts:48` parity test. STALE in register (test-enforced parity, not import-based). |

### 4b. Historical / Archive Candidates

| Risk | Basis for Archive |
|---|---|
| RISK-SEC-U01 | Fixed in Phase U commit; multiple Phase notes saying "gap remains" are incorrect. |
| RISK-SEC-U02 | Fixed in Phase U commit; same issue. |
| RISK-W01 | Parity test-enforced since Phase W; register disposition (import-based) was not applied but functional equivalent was. |
| Phase S hardening table | Already archived in register (cleared by Phase S; not open risks). |
| RISK-R01 | Already CLOSED in register (closed Phase T). |

---

## 5. Release-Blocking Subset

The following open risks should be addressed before any production launch that touches their scope:

| Risk | Severity | Blocking Reason |
|---|---|---|
| RISK-SEC-001 | HIGH | Migration 191 must be applied to DB before any authenticated client-side route over `theme_purchases` is added. ARB-gated. |
| RISK-GOV-001 | MEDIUM | Governance validator fails; must pass before merge per CLAUDE.md rule. |
| RISK-DATA-001 | MEDIUM | Migrations 186/187 untracked, 188-191 unapplied. Production DB state undefined. |
| RISK-TOCTOU-Q01 | MEDIUM | Plan limit bypass allows billing overprovisioning. Must be fixed before paid tiers go live. |
| RISK-T01 | MEDIUM | Pre-Zod depth attack via marketplace validation (reachable even with Liquid OFF). |
| RISK-T02 | MEDIUM | __proto__ bypass in bundle parse (reachable even with Liquid OFF via marketplace). |
| RISK-T05 | MEDIUM | Add-child button dead for all merchants (functional regression). |
| RISK-AC-01 | MEDIUM | Overlay must be allowlist-filtered before gateway AI route is deployed. |
| RISK-AC-02 | MEDIUM | WCAG guarantee broken for non-white backgrounds; AI accessibility fix misrepresents compliance. |

---

## 6. Internal-Canary-Blocking Subset

The following risks must be addressed before ANY store's Liquid canary flag is set to `true`
(i.e., before `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` is flipped or any per-store override is granted):

| Risk | Severity | Reason |
|---|---|---|
| RISK-T03 | LOW | Block settings bypass filterBlockedSettingsKeys in renderer — credential-key exposure via `{{ block.settings.api_key }}` |
| RISK-T01 | MEDIUM | Stack-depth attack via z.lazy() during bundle parse |
| RISK-T02 | MEDIUM | __proto__ bypass via parseLiquidThemePackageBundle |
| RISK-W06 | LOW | Block-level resolveDynamicSourceDescriptors gap — resource picker blocks won't resolve, renders broken |
| RISK-Z02 | LOW | lookupTranslation missing BLOCKED_PATH_SEGMENTS guard — proto pollution via `t` filter |
| RISK-Y01 | LOW | MAX_APP_BLOCKS_PER_SLOT not enforced at render time |
| RISK-W03 | LOW | siteDrops trust boundary comment-only (must be structurally enforced before storefront hydration) |

---

## 7. Deferred-But-Honest Subset

The following are confirmed open but do not block the current phase (Liquid OFF, gateway NOT-CONNECTED,
or bounded single-tenant impact):

| Risk | Status | Why Deferred |
|---|---|---|
| RISK-SEC-P01 | VERIFIED_CURRENT | No client-side realtime subscription over `theme_editor_drafts` |
| RISK-TOCTOU-P01, P02 | VERIFIED_CURRENT | Sequential retry (dominant pattern) works; concurrent window is narrow |
| RISK-SEC-U03 | VERIFIED_CURRENT | Design decision documented; no practical schema author impact until console merchants use required checkboxes |
| RISK-A11Y-U01 | VERIFIED_CURRENT | Screen reader inconsistency; not a security or data gap |
| RISK-A11Y-U02 | VERIFIED_CURRENT | Minor aria-describedby inconsistency; low screen-reader impact |
| RISK-STYLE-U01, U02 | VERIFIED_CURRENT | Design token inconsistency; no user-facing impact |
| RISK-DUAL-N01 | VERIFIED_CURRENT | Ongoing process requirement; mechanically enforced |
| RISK-ARCH-N01 | VERIFIED_CURRENT | Process rule; only relevant when ThemeDocumentSchema gains new fields |
| RISK-PERF-N01 | VERIFIED_CURRENT | Partial mitigation active; no perf regression observed |
| RISK-W02 | VERIFIED_CURRENT | DB check still enforces correctness; fast-fail is defence-in-depth |
| RISK-W04, W05 | UNKNOWN | ResourcePickerControl UX gaps; no correctness or security impact |
| RISK-AC-03, AC-04, AC-05 | VERIFIED_CURRENT | Latent while gateway NOT-CONNECTED; cosmetic or test gaps |
| RISK-AB-01, AB-02, AB-03 | VERIFIED_CURRENT | ARB-gated or test-scope gaps |
| RISK-AE-TEST-002 | VERIFIED_CURRENT | Test quality gap; no correctness risk |
| RISK-AE-SEC-003 | VERIFIED_CURRENT | Architectural residual; UUID collision effectively impossible |
| RISK-Z01 | VERIFIED_CURRENT | Only affects stores with bare `'en'` locale (rare; DB default is 'en-IN') |
| RISK-Z03-Z06 | VERIFIED_CURRENT | Gateway validation still enforces correctness; proxy gaps are defence-in-depth |
| RISK-AA-01, AA-02 | VERIFIED_CURRENT | Test coverage gaps; no actual bypass |
| RISK-AA-03 | ACCEPTED | India-first market browser floor; deliberate acceptance |
| RISK-O01, O02 | VERIFIED_CURRENT | Process requirement and advisory diff; no active bug |
| RISK-T04, T06 | VERIFIED_CURRENT | Test quality and dead API; no security impact |

---

## 8. Stale Register Entries Requiring Immediate Update

The following entries in `RISK_REGISTER.md` contain incorrect "OPEN · gap remains" status notes
that contradict current code evidence:

1. **RISK-SEC-U01** (and all Phase AC "gap remains" notes): Fixed in Phase U commit `45df4ae3`.
   `isUnsafeUrl` at `schema-field-extensions.ts:112-128` already blocks all listed protocols.

2. **RISK-SEC-U02** (and all Phase AC "gap remains" notes): Fixed in Phase U commit `45df4ae3`.
   `color_background` validation at `schema-field-extensions.ts:237` already rejects `url(`.

3. **RISK-W01** (and Phase AC "gap remains" note): Parity enforced by test since Phase W commit
   `7a507bbd`. `dynamic-source-binding.test.ts:48` asserts superset parity at every build.

4. **RISK-DATA-001**: Missing migration 191 from the "committed-but-unapplied" list.

5. All risks retargeted to "Phase AD" that were NOT closed: Phase AD (commit `9b4ad6fb`) was a
   docs-only phase. All "Retarget: Phase AD" entries need to be updated to "Phase AG" or
   "ARB follow-up" as appropriate.

---

## 9. STOP/GO Inputs (AF_1 Decision)

This workstream contributes the following inputs to the AF_1 STOP/GO gate:

**STOP signals (must be resolved before GO):**
1. Migration 191 is committed but NOT applied to the production DB. RISK-SEC-001 remains
   HIGH until the ARB-gated apply completes. No authenticated client-side theme_purchases route
   must go live before apply.
2. Migrations 186 and 187 are UNTRACKED — their apply order and DB state are undefined.
3. The governance validator (RISK-GOV-001) has a pre-existing failure. All phases including
   AF must not add new tenant-table drift.
4. RISK-TOCTOU-Q01 is OPEN at MEDIUM — plan limit bypass allows billing overprovisioning.
   Must be closed before paid tiers launch.
5. RISK-T01 and RISK-T02 are OPEN at MEDIUM and are reachable via the marketplace validation
   path even while Liquid is OFF. These must be fixed before the marketplace gate handles
   untrusted third-party bundles.
6. RISK-AC-01 and RISK-AC-03 must be fixed before the gateway AI-customization route is deployed
   (currently NOT-CONNECTED; not a current STOP but a pre-deploy gate).

**GO-supporting evidence:**
1. ART-17 Liquid canary is confirmed OFF (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` at
   `packages/theme-engine/src/theme-governance.ts:14`). No canary-blocking risk is currently active.
2. RISK-AE-SEC-001 (walkStringLeaves bypass) is CONFIRMED FIXED with `MAX_SETTINGS_WALK_DEPTH=12`
   + fail-closed truncation. The marketplace gate is sound for this path.
3. RISK-SEC-U01 and RISK-SEC-U02 are CONFIRMED FIXED in Phase U (register is stale — these
   do NOT represent open vulnerabilities).
4. RISK-W01 parity is CONFIRMED TEST-ENFORCED (register is stale — parity is asserted at
   every build via `dynamic-source-binding.test.ts:48`).
5. RISK-SEC-001 code fix is CORRECT and committed; the only gap is the DB apply, which is
   ARB-controlled.

**Unknowns (must remain UNKNOWN):**
1. Whether migration 191 (or 188/189/190) has been applied to staging or production DB.
2. Current exit status of `node scripts/validate-governance.mjs` (not run in this audit
   due to mutation-side-effect rule; PENDING confirmation by human).
3. RISK-Z06 (gateway `stores-localization.ts` DELETE handler locale guard) — file not
   directly inspected in this audit.
4. RISK-W04, RISK-W05 (ResourcePickerControl UX gaps) — file not directly inspected.
