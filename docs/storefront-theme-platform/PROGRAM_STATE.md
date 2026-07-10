# M→AE Program State

**Updated:** 2026-07-11 (post Phase V) · **Branch:** `stepup/main` · **Starting HEAD (program):** `29f87115`

## Scoreboard
| Phase | Title | Status | Commit |
|-------|-------|--------|--------|
| M | Repository truth + Shopify parity | COMPLETE | _(baseline commit)_ |
| N | Canonical Theme Document V2 | COMPLETE | _(see PHASE_N_REPORT.md)_ |
| O | Preset & Experience Engine 2.0 | COMPLETE | _(see PHASE_O_REPORT.md)_ |
| P | Drafts/revisions/publish/rollback | COMPLETE | _(see phase-p/PHASE_P_REPORT.md)_ |
| Q | Merchant theme library | COMPLETE | _(see phase-q/PHASE_Q_REPORT.md)_ |
| R | Visual editor shell | COMPLETE | _(see phase-r/PHASE_R_REPORT.md)_ |
| S | Live preview inspector | COMPLETE | _(see phase-s/PHASE_S_REPORT.md)_ |
| T | Section groups + nested blocks | COMPLETE | _(see phase-t/PHASE_T_REPORT.md)_ |
| U | Settings control renderer | COMPLETE | _(see phase-u/PHASE_U_REPORT.md)_ |
| V | Template system | COMPLETE | `36d6f342` (Lane A+hardening) `e9462067` (Lane B) |
| W | Dynamic sources + custom data | **NEXT** | — |
| X | Files & media library | PENDING | — |
| Y | Theme app extensions | PENDING | — |
| Z | Markets + localization | PENDING | — |
| AA | Custom CSS + code workspace | PENDING | — |
| AB | Theme versioning + updates | PENDING | — |
| AC | AI-assisted customization | PENDING | — |
| AD | Certification + canary | PENDING | — |
| AE | Marketplace + partner readiness | PENDING | — |

## Verified baselines (do not re-derive)
- theme-engine **643/643** entering M; **689/689** after Phase N (+46 tests, 20 suites); **1034/1034** after Phase O (+345 tests). storefront-runtime **687/687**, merchant **14 tasks**, gateway typecheck **32 tasks**.
- `validate-governance.mjs` **EXIT=1** — pre-existing tenant-registry drift only (foreign WIP); anti-fabrication PASS.
- All 11 B→L commits real + ancestors of HEAD. Phase L = HEAD (`29f87115`).
- `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` (theme-governance.ts:14). Frozen apps confirmed frozen.
- Phase Q gates: api-gateway **41/41** (file-scoped, `theme-library-q.test.ts`) · merchant **39/39** (24 Q + 15 pre-existing) · typecheck 32/32 api-gateway tasks + 14/14 merchant turbo tasks. 3 pre-existing failures unchanged.
- Phase R gates: merchant **65/65** (26 R + 25 Q + 14 pre-existing) · typecheck clean. No gateway, no migration, no new dependencies. 3 pre-existing failures unchanged.
- Phase S gates: merchant **93/93** (28 S + 26 R + 25 Q + 14 pre-existing) · storefront-runtime **795/795** (+33 inspector-bridge tests) · theme-engine **1048/1048** (+14 protocol tests) · all typechecks clean. No gateway, no migration, no new npm dependencies. 3 pre-existing failures unchanged.
- Phase T gates: merchant **120/120** (27 T + 28 S + 26 R + 25 Q + 14 pre-existing) · theme-engine **1063/1063** (+15 nested-block tests) · api-gateway **479/479** (unchanged) · storefront-runtime **795/795** (unchanged) · all typechecks clean. No gateway, no migration, no new npm dependencies. 3 pre-existing failures unchanged. Phase N fail-closed guard in `fromThemeDocumentV2` REMOVED (N-deferral CLOSED). RISK-R01 (local type mirrors) CLOSED — `BlockEntry.children` added to `SectionTreePanel.tsx` canonical `BlockEntry` type; `page.tsx` not touched (callbacks optional). RISK-T01/T02/T03/T04/T05/T06 registered (see RISK_REGISTER.md).
- Phase U gates: theme-engine **1136/1136** (baseline 1063 + 73 new) · merchant **196/196** (baseline 120 + 76 new) · api-gateway **479/479** (unchanged) · storefront-runtime **795/795** (unchanged) · all typechecks clean. No gateway, no migration, no new npm dependencies. 3 pre-existing failures unchanged. `validate-governance.mjs` EXIT=1 (pre-existing tenant drift; anti-fabrication PASS — unchanged). RISK-SEC-U01/U02/U03, RISK-A11Y-U01/U02, RISK-STYLE-U01/U02 registered (see RISK_REGISTER.md). RISK-T03/T04/T05/T06 target updated to Phase V.
- Phase V gates: theme-engine **1385/1385** (baseline 1141 + 244 new) · merchant **231/231** (baseline 196 + 35 new) · api-gateway **479/479** (unchanged) · storefront-runtime **795/795** (unchanged) · all typechecks clean. No gateway, no migration, no new npm dependencies. 3 pre-existing failures unchanged. `validate-governance.mjs` EXIT=1 (pre-existing tenant drift; anti-fabrication PASS — unchanged). RISK-T03/T04/T05/T06 retargeted to Phase W. RISK-SEC-U01/U02/U03, RISK-A11Y-U01/U02, RISK-STYLE-U01/U02 retargeted to Phase W or first touch. No new risks introduced.

## Phase V deliverables
- `packages/theme-engine/src/template-registry.ts` (NEW, 600 lines): `TEMPLATE_TYPE_REGISTRY` (23 base keys), `TemplateTypeEntry` interface, `parseTemplateKey`, `validateTemplateKey` (6 constraints + consecutive-slash hardening), `resolveAlternateTemplate` (hasOwnProperty-safe), `getAllowedDropsForTemplate`, `findExcessiveVariantCounts`, `InvalidTemplateKeyError`, `MAX_TEMPLATE_VARIANTS_PER_TYPE=20`, `MAX_TEMPLATE_KEY_LENGTH=120`, `REGISTRY_BASE_TYPE_COUNT`.
- `packages/theme-engine/test/template-registry.test.ts` (NEW, 725 lines, **244 tests**): constants, registry coverage (23 keys), per-entry structure (92 tests), registry semantics, parseTemplateKey, validateTemplateKey accepts/rejects, resolveAlternateTemplate, getAllowedDropsForTemplate, findExcessiveVariantCounts, round-trip compat (3 fixtures), schema integration (variant cap enforcement), 5 hardening tests.
- `packages/theme-engine/src/theme-document.ts` (MODIFIED): imports from `template-registry`; `ThemeDocumentTemplateSchema.superRefine` path-safety guard; `ThemeDocumentSchema.superRefine` check #6 (variant cap via `findExcessiveVariantCounts`); `toThemeDocumentV2` pre-conversion sanity pass + docblock.
- `packages/theme-engine/src/index.ts` (MODIFIED): `export * from './template-registry'` added.
- `apps/merchant-control-plane/src/components/theme-editor/TemplateSwitcherPanel.tsx` (NEW, 333 lines): `'use client'`; `TemplateSwitcherPanelProps`; `TemplateSwitcherOption`, `TemplateSwitcherVariant`; `useTemplateSwitcher` (pure parser, `@note` hook-name annotation); `role="listbox"` + `role="option"` alternate variant list; `aria-selected` + keyboard handler; loading/empty/error/disabled states; RISK-DUAL-N01 enforced; `--lb-*` tokens only; no page.tsx/Supabase/api-client import.
- `apps/merchant-control-plane/tests/theme-editor-v.test.mjs` (NEW, 276 lines, **35 tests**): file existence, import compliance, design ratchet, props interface, RISK-DUAL-N01 isolation, ARIA, slash-key handling, state handling, useTemplateSwitcher export.
- `apps/merchant-control-plane/package.json` (MODIFIED, FOREIGN WIP): `theme-editor-v.test.mjs` appended to test script.
- **6 hardening findings, all resolved before close** (CRITICAL: Lane A unstaged → committed atomically; 2×MEDIUM: variant cap wired into superRefine + toThemeDocumentV2 sanity pass; 3×LOW: consecutive-slash guard + useTemplateSwitcher annotation + duplicate MEDIUM). No open findings from Phase V review.
- RISK-T03/T04/T05/T06 and RISK-SEC-U01/U02/U03, RISK-A11Y-U01/U02, RISK-STYLE-U01/U02 all retargeted to Phase W (not addressed in Phase V — narrowly out of scope).

## Foreign WIP (PRESERVE — never stage)
- ~360 modified/untracked files from prior user work (apps/identity-platform, marketing-site, merchant-control-plane, services, database, tests/launch/lb*.mjs, next-env.d.ts).
- Untracked load-bearing theme-engine WIP: `experience-fonts.ts`, `industry-experience-map.ts`, `theme-bundle-core.ts` + their tests, `theme-presets.test.ts`.
- Untracked migrations `186_*`, `187_*`.
- `tenant-tables.registry.ts` drift.

## Active risks
See RISK_REGISTER.md: RISK-SEC-001 (theme_purchases wide-open RLS, HIGH, → AE), RISK-SEC-002 (editor AI stub), RISK-GOV-001 (tenant-registry, affects W), RISK-DATA-001 (migrations 186/187/188/189/190), RISK-DUAL-N01 (section_definitions dual-truth, OPEN, mechanically guarded by buildDraftConfig; Phase T/U/V callbacks+controls+switcher receive value+onChange+key only — guard preserved), RISK-ARCH-N01 (version gate must be bumped for future schema additions, ongoing), RISK-PERF-N01 (large document size, OPEN, buildDraftConfig mitigates on save path; hard bound deferred), RISK-O01 (Nova/Summit distinctness collapses if cta-section removed from bundle, LOW), RISK-O02 (collectionFilter/faqAccordion permanently incompatible until bundle expanded, LOW), RISK-SEC-P01 (theme_editor_drafts RLS checks user_id only, MEDIUM, no realtime subscription added through Phase V; still targeted at security migration before any realtime), RISK-TOCTOU-P01 (publish TOCTOU concurrent window, LOW, ARB-gated), RISK-TOCTOU-P02 (rollback CAS TS-level only, LOW, ARB-gated), RISK-TOCTOU-Q01 (plan-limit count-then-insert non-atomic, MEDIUM, ARB-gated → Phase AB or earlier), **RISK-R01 CLOSED**. **Phase T risks (all OPEN → Phase W):** RISK-T01 (pre-Zod stack-depth attack via z.lazy(), MEDIUM), RISK-T02 (no assertNoBlockedKeysInRaw in parseLiquidThemePackageBundle, MEDIUM), RISK-T03 (block settings bypass filterBlockedSettingsKeys, LOW, target Phase W), RISK-T04 (RENDERER_MAX_BLOCK_DEPTH private/unexported, LOW, target Phase W), RISK-T05 (allowedChildTypes not wired from SectionTreePanel to BlockChildRow — add-child dead, MEDIUM, target Phase W), RISK-T06 (UnsupportedThemeDocumentFeatureError dead export, LOW, target Phase W). **Phase U risks (all OPEN → Phase W or first touch):** RISK-SEC-U01 (isUnsafeUrl narrow blocklist, MEDIUM), RISK-SEC-U02 (ColorBackgroundControl gradient mode no url() content check, MEDIUM), RISK-SEC-U03 (required:true on checkbox/toggle is a validation no-op, MEDIUM), RISK-A11Y-U01 (TextInput/TextareaInput missing aria-describedby linkage, MEDIUM), RISK-A11Y-U02 (ternary aria-describedby drops helpText when error present, LOW), RISK-STYLE-U01 (LiquidControl fontSize:12 raw pixel, LOW), RISK-STYLE-U02 (controls.module.css raw px spacing, LOW). **Phase V: no new risks registered.**

## Parity snapshot (Phase M matrix)
COMPLETE 37 · PARTIAL 15 · MISSING 13 · NOT_CONNECTED 4 · STUB 1 (70 capability rows). Editor is the largest gap cluster (shell/inspector/tree/nested-blocks/templates/media/markets/code editor all PARTIAL or MISSING).

## Phase N deliverables
- `packages/theme-engine/src/theme-document.ts` (647 lines): `ThemeDocumentSchema`, `parseThemeDocument`, `toThemeDocumentV2`, `fromThemeDocumentV2`, version gate, error classes, bounds constants, pollution guards.
- `packages/theme-engine/src/theme-document-migrations.ts` (135 lines): `migrateToThemeDocumentV2` — SHAPE-1/2/3 detection.
- `packages/theme-engine/test/theme-document.test.ts` (756 lines, 37 tests).
- `packages/theme-engine/test/theme-document-migrations.test.ts` (169 lines, 9 tests).
- `packages/theme-engine/src/index.ts`: 2 export lines added.
- Round-trip proven in 4 directions; structural deepEqual for all 3 fixtures; render parity for Urban Kicks + LetBuyy Core; 6 code review findings resolved.

## Phase O deliverables
- `packages/theme-engine/src/section-type-map.ts` (109 lines): 25-entry camelCase→kebab bridge, `resolveLiquidSectionType()`, governance integrity check.
- `packages/theme-engine/src/experience-compositions.ts` (373 lines): 10 experiences × 3 templates; all structurally distinct index compositions; stable ids; static settings; no blocks field.
- `packages/theme-engine/src/experience-apply.ts` (719 lines): `ExperienceApplyMode` / `ExperienceApplyDiff` / `computeExperienceApplyDiff` (pure) / `applyExperienceToDocument` (fail-closed); content classification engine; RISK-DUAL-N01 + ART-17 enforcement.
- `packages/theme-engine/test/experience-apply.test.ts` (764 lines, 15 describe blocks).
- `packages/theme-engine/test/experience-compositions.test.ts` (329 lines, 6 describe blocks).
- `packages/theme-engine/src/index.ts`: 3 export lines added.
- 1034/1034 tests pass (+345). 5 code review findings resolved (2 HIGH, 3 LOW). All 10 index compositions structurally distinct (composition-level and post-apply). Nova and Summit proven distinct via `cta-section`. Content never silently lost: block loss surfaced in diff; `requiresDuplicateBeforeApply` fires independent of `preserveContent`.

## Phase P deliverables
- `database/supabase/migrations/189_theme_persistence_idempotency.sql` (NEW): nullable `idempotency_key` column + partial unique index `(store_id, idempotency_key) WHERE NOT NULL AND deleted_at IS NULL` on `theme_releases`. PRODUCTION APPLY IS ARB/HUMAN-GATED.
- `services/api-gateway/src/schemas/theme.schema.ts` (MODIFIED): `ValidateThemeDocumentSchema` added; `idempotency_key` added to `PublishThemeSchema`; `expected_current_release_id` added to `RollbackThemeReleaseSchema`.
- `services/api-gateway/src/execution/theme-execution.adapter.ts` (MODIFIED): `validateDocument()` new method; `publish()` gains idempotency pre-check + post-enrich (with error handling) + audit event; `rollbackRelease()` gains CAS guard + audit event; 3 new `store_id` guards on pre-existing UPDATE calls; fallback supersede error captured.
- `services/api-gateway/src/routes/themes.ts` (MODIFIED): `POST /:slug/validate` registered before GET catch-all.
- `services/api-gateway/src/__tests__/theme-persistence-p.test.ts` (NEW): 24 tests; cross-tenant proof via mock-db + source-pattern layers.
- api-gateway unit gate: **438/438** pass (3 pre-existing failures unchanged). theme-engine: **1034/1034** unchanged. Typecheck: **32/32** clean.

## Phase Q deliverables
- **Lane A — Gateway:** `database/supabase/migrations/190_theme_library_q.sql` (additive, ARB-gated apply). `packages/billing-core/src/index.ts`: `themes` limit added to all 6 tier blocks (free=1, starter=3, business=10, enterprise=null, launch=3, growth=5). `packages/typescript/api-client/src/index.ts`: 6 new typed stubs. `services/api-gateway/src/schemas/theme.schema.ts`: 6 new Zod schemas. `services/api-gateway/src/execution/theme-execution.adapter.ts`: 6 new adapter methods (all call `verifyStoreOwner` first; `renameSiteTheme` has 3-layer catalog-integrity protection; `archiveSiteTheme` + `deleteUnpublishedSiteTheme` have published-theme blocks). `services/api-gateway/src/routes/themes.ts`: 6 new `authMiddleware` registrations before all `/:slug/*` entries + 6 new route handlers + `resolveStoreThemeLimit`/`countInstalledSiteThemes` helpers. `services/api-gateway/src/__tests__/theme-library-q.test.ts`: 41 tests.
- **Lane B — Merchant UI:** 6 new proxy routes (library GET, library create POST, [themeId] duplicate POST, [themeId] rename PATCH, [themeId] archive POST, [themeId] DELETE). `ThemeLibraryCard.tsx` + `ThemeLibraryWorkspace.tsx` (ARIA, en-IN dates, `--lb-*` tokens, loading/empty/error states, responsive grid, modals, ConfirmDialogs). `themes/page.tsx`: ARIA tab strip ("My themes" default → `ThemeLibraryWorkspace`; "Discover themes" → existing catalog). `tests/theme-library-q.test.mjs`: 24 tests.
- **Hardening (3 findings fixed before close):** renameSiteTheme catalog contamination (HIGH) → `owned_by_site_id` app-level check + DB-level UPDATE scope. IDOR plan-limit leak (MEDIUM) → `verifyStoreOwner` before `resolveStoreThemeLimit` on create/duplicate. `handlePublish` 400 on every click (MEDIUM) → `store_name` moved to URL query param.
- **RISK-TOCTOU-Q01 registered:** Plan limit count-then-insert is non-atomic. Sequential requests correctly gated; concurrent race ARB-gated for DB-level enforcement.

## Phase R deliverables
- `apps/merchant-control-plane/src/components/theme-editor/ConflictDialog.tsx` (NEW, 68 lines): wraps `@letbuyy/ui ConfirmDialog`; safe light-dismiss → reload; explicit button → force-save; `ConflictSource` discriminates autosave vs manual-save context.
- `apps/merchant-control-plane/src/components/theme-editor/SectionTreePanel.tsx` (NEW, 447 lines): extracted from inline `SectionTree`/`TreeGroup`/`TreeSection`; `role="tree"` container; `role="treeitem"` + `aria-selected` + roving `tabIndex` on rows; action buttons `tabIndex={-1}`; `isActiveParent` for block-selection state; `ArrowUp`/`ArrowDown` keyboard nav via event delegation; HTML5 drag-to-reorder with full step-distance loop; drag-over via `.theme-os-tree-section--drag-over` CSS class (token-only); block-count `aria-label` on section rows. `TreeGroup` re-exported for `ThemeSettingsTree` and `VersionTree`.
- `apps/merchant-control-plane/tests/theme-editor-r.test.mjs` (NEW, 212 lines, 26 tests): static contract tests — file existence, `@letbuyy/ui` import, design ratchet, ARIA tree attributes, D&D handlers, `TreeGroup` re-export, `page.tsx` imports, inline declaration removal, conflict state, 409 detection, `onReload`/`onForce` wiring, no Supabase in new components.
- `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` (FOREIGN WIP, 4 hunks): import block + conflict state + 409 detection in `saveDraft`/`syncPreviewDraft` + JSX replacement of inline tree + inline declaration deletion + `undo()` dirty-state fix + `onForce` `.catch()` hardening.
- `apps/merchant-control-plane/src/app/globals.css` (FOREIGN WIP, 5 lines): `.theme-os-tree-section--drag-over` rule, token-only, no hex.
- `apps/merchant-control-plane/package.json` (CLEAN): `theme-editor-r.test.mjs` appended to test script.
- **RISK-DUAL-N01:** mechanically guarded by `buildDraftConfig` (immutable fields from `baseConfig`, never `editorState`). Risk remains OPEN for future phases.
- **RISK-PERF-N01:** `buildDraftConfig` mitigates the save-path serialization concern (mutable state only, not Liquid source). Hard bound deferred to Phase S.
- **8 HIGH/MEDIUM findings fixed in hardening** (ConflictDialog light-dismiss swap, drag multi-step loop, block-selection roving tabindex, drag-over CSS class, action button tabIndex, ChevronDown removal, undo dirty-state, onForce .catch()). 2 LOW findings deferred.

## Phase S deliverables
- `packages/theme-engine/src/editor-bridge-protocol.ts` (MODIFIED): 4 new `INSPECTOR_*` constants (`INSPECTOR_SECTION_HOVERED`, `INSPECTOR_HOVER_CLEARED`, `INSPECTOR_ADD_SECTION_INTENT`, `INSPECTOR_SECTION_SCROLLED_TO`) with JSDoc documenting same-window-only constraint for `SCROLLED_TO`.
- `apps/merchant-control-plane/src/components/theme-editor/PreviewInspectorOverlay.tsx` (NEW, 57 lines): pointer-enhancement hover chip; `aria-hidden`; `pointer-events: none`; no messaging; `--lb-*` tokens; `prefers-reduced-motion` guard on chip animation.
- `apps/merchant-control-plane/src/components/theme-editor/CenterPanel.tsx` (MODIFIED): `previewOrigin` memo; fail-closed receive guard; `hoveredSection` state; optional `onHoverSection` / `onAddSectionIntent` props; 3 new switch cases; `EDITOR_SCROLL_MESSAGE` send; `<PreviewInspectorOverlay>`; clears hover on URL change.
- `apps/merchant-control-plane/src/app/globals.css` (FOREIGN WIP, CSS addition): `.te-inspector-overlay`, `.te-inspector-hover-chip`, `@keyframes te-inspector-chip-in`, `prefers-reduced-motion` guard — all `--lb-*` tokens.
- `apps/merchant-control-plane/tests/theme-editor-s.test.mjs` (NEW, 28 tests: 24 Phase S + 4 hardening).
- `packages/theme-engine/test/editor-bridge-protocol.test.ts` (NEW, 15 tests: constant values, uniqueness, namespace, count).
- `apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx` (MODIFIED): `getEditorOrigin()`; fail-closed guard; READY_MESSAGE suppressed not `'*'`; double-scroll fix (`LEGACY` → `shouldScroll=false`); `INSPECTOR_SECTION_SCROLLED_TO` same-window dispatch after scroll.
- `apps/storefront-runtime/src/lib/theme-engine/editor-preview-section-frame.tsx` (MODIFIED): `getEditorOrigin()`; same-window receive guard; `notifyHover` sends; `sendAddIntent`; `triggerFlash` with reflow; insert-before/after buttons; `flashTimerRef` unmount cleanup.
- `apps/storefront-runtime/src/app/globals.css` (FOREIGN WIP, CSS addition): `@keyframes sf-section-frame-flash`, `.storefront-editor-section-frame--flash`, `prefers-reduced-motion` guard, `.storefront-editor-section-insert` family — `--lb-*` tokens.
- `tests/theme-engine/inspector-bridge.test.mjs` (NEW, 33 tests: 29 Phase S + 4 hardening).
- **8 findings resolved in hardening** (HIGH: `INSPECTOR_ADD_SECTION_INTENT` unhandled; 2×MEDIUM: fail-open guard + double-scroll; 5×LOW: READY wildcard, raw px/hex, reduced-motion guard, token compliance). No deferred findings.
- **RISK-DUAL-N01**: preserved — `sendAddIntent` sends intent only (`adjacentSectionId` + `position`); no section object or template mutation from preview.
- **RISK-SEC-P01**: unchanged — no realtime subscription added. Still targeted before any Phase T+ realtime feature.
- **RISK-PERF-N01**: hard byte bound still deferred. `buildDraftConfig` mitigation unchanged.

## Phase T deliverables
- `packages/theme-engine/src/theme-bundle.ts` (MODIFIED): `ThemeBundleTemplateBlock` interface with `blocks` + `block_order`; `ThemeBundleTemplateBlockSchema` self-recursive via `z.lazy()`; `MAX_BUNDLE_BLOCK_NESTING_DEPTH=3`; depth `superRefine` in `ThemeBundleTemplateSectionSchema`; `allowed_child_types` optional field on `ThemeLiquidReusableBlockSchema`.
- `packages/theme-engine/src/theme-document.ts` (MODIFIED): Phase N fail-closed guard at line 653 REMOVED (N-deferral CLOSED); `docBlockToBundleBlock` + `bundleBlockToDocBlock` recursive helpers; `validateBlockChildTypes` function; §5 superRefine call in `ThemeDocumentSchema`.
- `packages/theme-engine/src/theme-renderer.ts` (MODIFIED): `RENDERER_MAX_BLOCK_DEPTH=3` private const; `depth` parameter on `renderLiquidSectionBlocks`; recursive child rendering with crash-isolation; `sub_blocks` threaded into parent block Liquid drop; `LiquidRenderedBlock.sub_blocks?: LiquidRenderedBlock[]`.
- `packages/theme-engine/src/index.ts` (MODIFIED): `BlockModel.children?: BlockModel[]` (additive, optional).
- `packages/theme-engine/test/theme-document.test.ts` (MODIFIED): Phase N test "throws UnsupportedThemeDocumentFeatureError" replaced 1-for-1 with Phase T test "fromThemeDocumentV2 succeeds with non-empty block children and round-trips losslessly" (count stays 37).
- `packages/theme-engine/test/theme-document-nested-blocks.test.ts` (NEW, 713 lines, 15 tests): depth rejection, at-max acceptance, flat byte-identity, 2-level round-trip, `allowed_child_types` enforcement, renderer depth safety, sanitizer proof, `sub_blocks` availability, determinism.
- `apps/merchant-control-plane/src/components/theme-editor/BlockChildRow.tsx` (NEW, 284 lines): `'use client'`; recursive; `MAX_EDITOR_BLOCK_DEPTH=3` exported; `aria-level` + `role="treeitem"`; `theme-os-tree-block--depth-N` modifier; `@letbuyy/ui` imports only.
- `apps/merchant-control-plane/src/components/theme-editor/SectionTreePanel.tsx` (MODIFIED): `BlockEntry.children?: BlockEntry[]`; three optional child callbacks; block rendering delegated to `BlockChildRow`.
- `apps/merchant-control-plane/tests/theme-editor-t.test.mjs` (NEW, 286 lines, 27 test() calls): file existence, import compliance, design ratchet, type shapes, depth guard, ARIA, RISK-DUAL-N01 isolation, callback optionality.
- `apps/merchant-control-plane/package.json` (MODIFIED, FOREIGN WIP): `theme-editor-t.test.mjs` appended to test script.
- **7 findings, 0 fixed in phase (all deferred):** 2×MEDIUM (RISK-T01 pre-Zod stack depth, RISK-T02 prototype pollution in bundle path), 1×MEDIUM functional (RISK-T05 add-child dead wiring), 3×LOW (RISK-T03 block settings bypass, RISK-T04 private renderer const, RISK-T06 dead export). See PHASE_T_SECURITY_REVIEW.md.
- **RISK-DUAL-N01**: preserved — child callbacks mutate instance tree (`template.sections[].blocks[].children`); `block_definitions` comes from `baseConfig`, never written by Phase T code.
- **RISK-SEC-P01**: unchanged — no realtime subscription added.
- **RISK-R01**: CLOSED — `BlockEntry.children` added to canonical `BlockEntry` type in `SectionTreePanel.tsx`; `page.tsx` not touched (callbacks optional).

## Phase U deliverables
- `packages/theme-engine/src/schema-field-extensions.ts` (NEW): `ExtendedSchemaField` (26-type superset of frozen `SchemaField`), `ExtendedFieldType` (15 new type literals), `AllFieldType`, `isUnsafeUrl` (4-check URL safety helper, public re-expression of private `isUnsafeThemeUrl`), `validateFieldValue` (pure; bounds/URL/font/maxLength/required checks), `isFieldVisible` (strict-equality `visible_if` guard), `resolveFieldDefault` (type-safe defaults for boolean/numeric/info/text controls).
- `packages/theme-engine/test/schema-field-extensions.test.ts` (NEW): 73 new tests; theme-engine total **1136/1136**.
- `packages/theme-engine/src/index.ts` (MODIFIED): one `export *` line added.
- `apps/merchant-control-plane/src/lib/theme-schemas.ts` (MODIFIED): re-exports all 4 helpers + 3 types from `@letbuyy/theme-engine`.
- `apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx` (MODIFIED): upgraded to `ExtendedSchemaField`; `isFieldVisible` loop; `resolveFieldDefault`; 15 new switch cases; `number` now enforces min/max/step; `url` now checks `isUnsafeUrl`.
- `apps/merchant-control-plane/src/components/theme-editor/controls/` (NEW DIRECTORY): 11 files — `CheckboxControl.tsx`, `ColorBackgroundControl.tsx`, `ColorSchemeControl.tsx`, `FontPickerControl.tsx`, `HtmlControl.tsx`, `LiquidControl.tsx`, `VideoControl.tsx`, `VideoUrlControl.tsx`, `InfoControls.tsx`, `ResourcePickerControl.tsx`, `controls.module.css`.
- `apps/merchant-control-plane/tests/theme-editor-u.test.mjs` (NEW): 76 new Phase U static-contract tests; merchant total **196/196**.
- `apps/merchant-control-plane/package.json` (MODIFIED, FOREIGN WIP): `theme-editor-u.test.mjs` appended to test script.
- 7 Phase U findings — 0 fixed before close (Hardening: null). All 7 registered in RISK_REGISTER.md as RISK-SEC-U01/U02/U03, RISK-A11Y-U01/U02, RISK-STYLE-U01/U02.
- RISK-T03/T04/T05/T06 carry-over targets updated to Phase V (not addressed in Phase U).

## Next action
- **Next phase: W — Dynamic sources + custom data.**
- **Phase W must:** address RISK-T03 (`block.settings` bypass of `filterBlockedSettingsKeys`) if touching `theme-renderer.ts`; address RISK-T05 (`allowedChildTypes` not wired to `BlockChildRow`) if touching `SectionTreePanel.tsx`; address RISK-SEC-U01/U02/U03, RISK-A11Y-U01/U02, RISK-STYLE-U01/U02 if touching `schema-field-extensions.ts` / controls; not add realtime subscriptions until RISK-SEC-P01 resolved; continue using `--lb-*` design tokens; address RISK-GOV-001 (tenant-registry drift) for any new tenant tables.
- **Gate entering V:** merchant **196/196** · api-gateway **479** · theme-engine **1136** · storefront-runtime **795** · all typechecks clean.
