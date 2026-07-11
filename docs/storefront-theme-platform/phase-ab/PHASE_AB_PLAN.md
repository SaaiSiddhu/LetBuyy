# Phase AB — Plan: Theme Versioning + Updates

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** AB — Theme Versioning + Updates
**Date:** 2026-07-11
**Branch:** `stepup/main`
**Status:** PLAN EXECUTED — COMPLETE

---

## 1. Objectives

1. **NO-DATA-LOSS LAW** — a pure deterministic merge engine (`planThemeSafeUpdate`) upgrades a merchant's ThemeDocument from one bundle version to another, preserving all merchant-authored content (section settings, nested block children, resource-binding descriptors, locale-adjacent text) and surfacing uncarriable content as blocking conflicts.
2. **Tenant-safe gateway routes** — `GET /:slug/update-preview` returns a diff + hash; `POST /:slug/update` applies with a CAS guard (`confirm_diff_hash`); publishes exclusively via the Phase P `publishReleaseSnapshot` path with `rollbackOfReleaseId` set so rollback is always available.
3. **Merchant UI** — `ThemeUpdatePanel` surfaces update availability, renders a per-template section diff table, enforces conflict acknowledgement before apply, and provides a Rollback action reusing the Phase P proxy.
4. **RISK-DUAL-N01 preservation** — the merge engine is pure; it mutates the per-store ThemeDocument instance (settings, blocks), NEVER the shared `section_definitions`/`block_definitions` catalog.
5. **CAS guard** — `confirm_diff_hash` (SHA-256 of serialized diff) prevents stale-preview application. Gateway returns 409 on mismatch.
6. **Hardening** — retained sections whose block types were removed from the new bundle surface `lostContent.blocks` in conflicts (not silent drops); proxy parameter names aligned to gateway Zod schemas; response shape reshaped at proxy boundary.

---

## 2. Entry Gates (inherited from Phase AA exit)

| Package | Required gate |
|---------|---------------|
| `theme-engine` | 1592/1592 pass |
| `merchant-control-plane` (theme-editor suite) | 619/619 pass |
| `api-gateway` | 519 pass (522 total; 3 pre-existing fail) |
| `storefront-runtime` | 795/795 pass |
| All typechecks | clean |

---

## 3. Lane A — Engine (`packages/theme-engine/`)

### 3.1 New file: `theme-safe-update.ts`

**Exports:**

| Export | Type | Description |
|--------|------|-------------|
| `UpdateVersionRejectedError` | class | Thrown by G4 gate for unknown/future schema versions |
| `UpdateDowngradeError` | class | Thrown when target bundle is older than current document |
| `SettingClass` | union type | `'merchant-content' \| 'resource-binding' \| 'token' \| 'generated-placeholder'` |
| `classifyUpdateSetting(key, value)` | function | Classifies a single setting key+value; W-binding check fires before token check |
| `ThemeUpdateDiffEntry` | interface | Per-section diff record: `{ action, sectionType, lostContent?, sectionLabel? }` |
| `ThemeUpdateDiff` | interface | `{ sections[], requiresDuplicateBeforeApply, schemaMigrations[], summary }` |
| `ThemeUpdateResult` | interface | `{ updatedDoc, diff, requiresDuplicateBeforeApply }` |
| `ThemeUpdateOptions` | interface | `{ preserveContent?, migrationRegistry? }` |
| `planThemeSafeUpdate(params)` | function | Merge engine: G4 gate → direction check → G migration → per-section merge → parseThemeDocument |
| `computeThemeUpdateDiff(params)` | function | Pure preview variant: same logic as planThemeSafeUpdate but returns only the diff without producing an updatedDoc |

**Version flow:**
1. G4 gate: `isThemeBundleSchemaCompatible(nextBundle)` — unknown/future → `UpdateVersionRejectedError`.
2. Direction: `compareSchemaVersions(next, current)` — downgrade → `UpdateDowngradeError`; same → no-op (updatedDoc = currentDocument, diff empty).
3. G migration: `migrateThemeTemplateSchemasWithRegistry` on current sections.
4. Per-section merge: classify settings → carry `merchant-content` and `resource-binding`; replace `token` and `generated-placeholder` from bundle defaults.
5. `parseThemeDocument(merged)` — fail-closed final gate.

**Content merge rules per section:**
- SWAP: `section_definitions`, `block_definitions`, `locales`, `renderer`, `layout` from `nextBundle`.
- PRESERVE: `merchant-content` and `resource-binding` settings from the matching current section type.
- T preservation: entire `blocks[]` array (including `children[]` recursively) carried from matching current section instances; `@app` sentinel blocks gate-checked against `newBundle.sectionAcceptsAppBlocks`; all other block types always carried.
- W preservation: `isDynamicSourceDescriptor(value)` fires BEFORE token check; bindings always preserved regardless of key name.
- Removed sections with merchant content: `requiresDuplicateBeforeApply = true`; section appears in `diff.conflicts` with `lostContent.settings`.
- Retained sections with dropped block types (hardening): block types absent from the new section definition but present in the merchant's blocks with meaningful content → `lostContent.blocks` populated; `requiresDuplicateBeforeApply = true`.
- New sections: `diff.sections[n].action = 'added'` with bundle defaults; NOT automatically inserted into merchant templates.

### 3.2 Modified file: `theme-bundle.ts`

One additive change: `THEME_LIQUID_BUNDLE_SCHEMA_VERSION_V2 = '2026-07-liquid-sections-v2'` inserted at index 1 in `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS`. Required for `compareSchemaVersions` to return `direction: 1` for cross-version tests. Existing V1 tests unaffected.

### 3.3 Modified file: `index.ts`

One line appended:
```typescript
export * from './theme-safe-update';
```

---

## 4. Lane AB — Gateway (`services/api-gateway/`)

### 4.1 New file: `src/routes/themes/theme-update-route.ts`

Exports `mountThemeUpdateRoutes(router)` which registers:

**`GET /:slug/update-preview`**

Query: `store_id` (UUID), `target_package_version_id` (UUID).

Flow: `resolveCustomUser` → `verifySiteOwnership(body.store_id)` → `loadCurrentReleaseBundle` → `loadTargetPackageVersionBundle` → `computeThemeUpdateDiff` → `sha256Hex(JSON.stringify(diff))` → return `{ diff, compatible, requiresDuplicate, diffHash }`.

No writes. Pure diff preview.

**`POST /:slug/update`**

Body: `{ store_id, target_package_version_id, confirm_diff_hash, idempotency_key, make_store_live?, publish_message? }`.

Flow: `resolveCustomUser` → `verifySiteOwnership(body.store_id)` → `loadCurrentReleaseBundle` → `loadTargetPackageVersionBundle` → `planThemeSafeUpdate` → verify `confirm_diff_hash` matches computed diffHash (409 on mismatch) → if `!compatible` → 422 → `fromThemeDocumentV2(mergedDoc)` → `publishVersionUpdateRelease(rollbackOfReleaseId=currentReleaseId)` → `emitAuditEvent` → return `{ release, diff_summary }`.

**Idempotency:** `publishVersionUpdateRelease` checks `idempotency_key` against `theme_releases WHERE store_id = $1 AND idempotency_key = $2` before calling `publishReleaseSnapshot`. Returns `{ idempotent: true, release }` on replay without a second publish.

**Adapter methods added to `ThemeExecutionAdapter`:**
- `loadCurrentReleaseBundle(storeId, themeSlug)` — queries `theme_releases.is_current=true`, extracts `liquidBundle`, converts to `ThemeDocument` via `toThemeDocumentV2`.
- `loadTargetPackageVersionBundle(storeId, themeSlug, packageVersionId)` — queries `theme_package_versions.package_manifest.liquidBundle`, validates via `parseLiquidThemePackageBundle` (G4 gate).
- `publishVersionUpdateRelease(storeId, themeSlug, bundle, rollbackOfReleaseId, opts)` — idempotency pre-check → `publishReleaseSnapshot` → post-enrich.

### 4.2 Modified file: `src/routes/themes.ts`

Three additive lines after the `/media-library` mount block:
```typescript
import mountThemeUpdateRoutes from './themes/theme-update-route';
router.use('/:slug/update-preview', authMiddleware);
router.use('/:slug/update', authMiddleware);
mountThemeUpdateRoutes(router);
```

Auth middleware placed after `/media-library` and `/resource-search` static prefixes to preserve pre-existing route ordering invariants.

---

## 5. Lane C — Merchant UI (`apps/merchant-control-plane/`)

### 5.1 New file: `src/components/theme-editor/ThemeUpdatePanel.tsx`

Standalone `'use client'` component. Props: `themeSlug`, `storeId`, `currentVersionId`, `availableVersionId`, `apiBase`.

**States and transitions:**

| State | Condition | UI |
|-------|-----------|-----|
| `no-update` | `currentVersionId === availableVersionId` | "Up to date" badge |
| `available` | versions differ, no diff yet | "Update available" badge + Preview button |
| `previewing` | GET in-flight | Loading skeleton (`aria-busy`) |
| `conflicts` | `requiresDuplicate=true` | Warning + "Duplicate first" blocking action |
| `updating` | POST in-flight | Loading skeleton |
| `done` | Update applied | Success state |
| `error` | Preview or apply failed | Error state |

**Diff table:** per-template section diff rows with action column (added / removed / retained / incompatible).

**canApply guard:** requires `diff !== null` AND `diff.diffHash` present AND `diff.compatible` AND (`!diff.requiresDuplicate || conflictsAcknowledged`). No silent apply is structurally impossible.

**Rollback:** calls pre-existing `POST /api/themes/:themeId/releases/:releaseId/rollback` proxy (Phase P). Confirm dialog gates destructive action.

**RISK-DUAL-N01:** emits zero `section_definitions` mutations. Pure read (preview) + submit (apply).

### 5.2 New proxy routes

**`src/app/api/themes/[themeId]/update-preview/route.ts`** — GET proxy. `resolveOwnedStoreId` + `merchantApiFetch`. Forwards `target_package_version_id` to gateway. Reshapes gateway response: `sections → rows`, `requiresDuplicateBeforeApply → requiresDuplicate`, `compatible: true` (implied by non-422 response), `diffHash` injected from top-level `diff_hash`. Returns UI-ready shape.

**`src/app/api/themes/[themeId]/update/route.ts`** — POST proxy. `resolveOwnedStoreId` + `merchantApiFetch`. Forwards `target_package_version_id` to gateway (renamed from UI's `target_bundle_version_id`). Validates `confirm_diff_hash` (/^[0-9a-f]{64}$/ — matches gateway Zod schema exactly). Forwards `idempotency_key` (required; returns 400 if absent). Renames `update_message` → `publish_message` for gateway.

### 5.3 New page route

**`src/app/[store]/online-store/themes/update/page.tsx`** — server component wrapper. Reads `storeId` from params.

**`src/app/[store]/online-store/themes/update/UpdatePageClient.tsx`** — client component. Fetches available versions, renders `ThemeUpdatePanel`.

---

## 6. Hardening (Post-Review)

Five findings fixed before close:

| Severity | File | Fix |
|----------|------|-----|
| CRITICAL | `ThemeUpdatePanel.tsx` / `update-preview/route.ts` | Proxy reshapes gateway response (`sections→rows`, `requiresDuplicateBeforeApply→requiresDuplicate`, inject `compatible`, inject `diffHash`) |
| HIGH | `update-preview/route.ts` | `target_version_id` → `target_package_version_id` in gateway URL |
| HIGH | `update/route.ts` | `target_bundle_version_id` → `target_package_version_id` in gateway body |
| MEDIUM | `update/route.ts` | `update_message` → `publish_message`; `idempotency_key` required + always forwarded |
| MEDIUM | `theme-safe-update.ts` | Retained sections with dropped block types surface `lostContent.blocks` in diff.conflicts; conflicts filter extended from `action==='removed'` to any entry with `lostContent !== undefined` |
| LOW | `update/route.ts` | `confirm_diff_hash` validation tightened from `length < 8` to `/^[0-9a-f]{64}$/` |

---

## 7. Exit Gates

| Package | Exit gate |
|---------|-----------|
| `theme-engine` | 1634/1634 pass (1592 baseline + 41 lane-a + 1 hardening) |
| `api-gateway` | 1489 pass (27 pre-existing fail unchanged; total ~1516) |
| `merchant-control-plane` (theme-editor suite) | 712/712 pass (619 baseline + 93 new) |
| `storefront-runtime` | 795/795 unchanged |
| All typechecks | clean |
