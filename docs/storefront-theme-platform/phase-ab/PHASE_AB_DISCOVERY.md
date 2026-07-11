# Phase AB — Discovery: Theme Versioning + Updates

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** AB — Theme Versioning + Updates
**Date:** 2026-07-11
**Branch:** `stepup/main`
**Status:** DISCOVERY COMPLETE

---

## 1. Scope

Phase AB delivers a three-lane tenant-safe theme version update system:

| Lane | Owner | Role |
|------|-------|------|
| A — Safe-update engine | `packages/theme-engine/` | Pure deterministic merge: preserve merchant customizations when upgrading from one bundle version to another |
| AB — Gateway routes | `services/api-gateway/` | Tenant-safe preview + apply routes; CAS guard; publish via P path |
| C — Merchant UI | `apps/merchant-control-plane/` | ThemeUpdatePanel: diff viewer, conflict surfacing, apply + rollback actions |

---

## 2. Pre-Phase-AB State

### 2.1 Theme releases already existed (Phase P)

Phase P delivered:
- `theme_releases` table with `idempotency_key` + partial unique index.
- `publishReleaseSnapshot()` in `ThemeExecutionAdapter` — the canonical publish path that all writes flow through.
- `rollbackRelease()` in `ThemeExecutionAdapter` — CAS-guarded rollback.
- `POST /:slug/releases/:releaseId/rollback` — Phase P rollback route already mounted in `themes.ts`.

What Phase P did NOT deliver:
- Any logic for merging merchant customizations from an old bundle version into a new one.
- A route for applying a bundle-version upgrade.
- A UI for viewing or confirming a version diff.

### 2.2 The merchant content preservation problem

When a theme bundle is updated from version V1 to V2, the new bundle may:
- Replace or rename section definitions (altering section_definitions + block_definitions keys).
- Add new section types that did not exist in V1.
- Remove section types that existed in V1 (where merchants may have placed customized content).
- Replace locale strings.

A naive overwrite of the merchant's ThemeDocument with V2 defaults would silently destroy:
- Per-section `settings` values (merchant-authored text, images, links, colours).
- Per-block `settings` values and block children (`T` surface).
- Resource-binding descriptors (`W` surface — `DynamicSourceDescriptor` values in settings).
- Locale-adjacent text carried in settings via `Z` classification.

This is the NO-DATA-LOSS LAW problem that Phase AB solves.

### 2.3 No diff preview existed

Before Phase AB, there was no way for a merchant to see what would change when applying a bundle update. Updates were all-or-nothing overwrites with no visibility into which sections had merchant content that might be affected.

### 2.4 The `custom_css` render wiring gap (from Phase AA)

Phase AA built `buildLiquidThemeHeadAssets(bundle, rawCustomCss?)` but left the call site at `layout.tsx` line 585 un-wired. Phase AB's scope does NOT include wiring this render path (it requires a different storefront-runtime commit that is out of the theme-update scope). The wiring remains a Phase AC/AD deliverable.

---

## 3. Version Model

### 3.1 Bundle schema versions

`packages/theme-engine/src/theme-bundle.ts` exports `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS`, an ordered array:

```typescript
const KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS = [
  '2026-07-liquid-sections-v1',   // Phase N original
  '2026-07-liquid-sections-v2',   // Phase AB addition — required for forward-update tests
] as const;
```

The G4 gate (`isThemeBundleSchemaCompatible`) rejects any bundle whose `schema_version` is not in this array. `compareSchemaVersions(a, b)` returns:
- `{ direction: 1 }` — `a` is newer (forward update).
- `{ direction: 0 }` — same version (no-op).
- `{ direction: -1 }` — `a` is older (downgrade — rejected).
- `{ direction: null }` — version unknown (rejected).

### 3.2 ThemeDocument version

The ThemeDocument V2 schema (`THEME_DOCUMENT_VERSION = '2026-07-liquid-v2'`) is already established by Phase N. Phase AB does NOT bump this version — it does not add new fields to `ThemeDocumentSchema`.

---

## 4. Customization Surfaces Requiring Preservation

Phase AB must preserve all five surfaces when upgrading:

| Surface | What it is | Location in ThemeDocument |
|---------|------------|--------------------------|
| U — section instance settings | Merchant-authored values (text, images, links, colours) | `section.settings[key]` |
| W — resource-binding descriptors | `DynamicSourceDescriptor` objects (ResourceBinding, MetafieldBinding, StaticBinding) | Any `section.settings[key]` where `isDynamicSourceDescriptor(value) === true` |
| T — nested block children | `ThemeDocumentBlock.children[]` (recursive, depth ≤ 3) | `section.blocks[id].children[]` |
| Z — locale-adjacent text | Text values in settings classified as `merchant-content` (non-empty, non-token, non-binding) | `section.settings[key]` — same as U but specifically the locale-adjacent text classification |
| G — schema migrations | Structural transformations declared in `AppliedThemeSchemaMigration` registry | Applied before the merge via `migrateThemeTemplateSchemasWithRegistry` |

---

## 5. Classification Model (Phase O Mirror)

The merge engine classifies each setting value into one of four categories to decide whether to carry it forward:

| Class | Carry forward? | Description |
|-------|---------------|-------------|
| `merchant-content` | Yes | Non-empty, non-token, non-binding string values (merchant text, URLs, etc.) |
| `resource-binding` | Yes | `DynamicSourceDescriptor` values (W surface) OR values whose key is in `EXPLICIT_RESOURCE_BINDING_KEYS` or matches `*Handle`/`*Id`/`*_handle`/`*_id` pattern |
| `token` | No (replaced by bundle) | Values whose key is in `TOKEN_KEYS` (design tokens: colors, fonts, sizes) |
| `generated-placeholder` | No (replaced by bundle) | `null`, `undefined`, or `''` — no merchant intent to preserve |

The `isDynamicSourceDescriptor` check fires BEFORE the token check (Phase AB addition — a binding value whose key happens to be in TOKEN_KEYS must still be preserved as a binding).

---

## 6. Conflict Model

Two conflict scenarios require `requiresDuplicateBeforeApply = true`:

1. **Removed section with merchant content:** A section type present in the current document but absent from the next bundle has `merchant-content` or `resource-binding` settings. The merchant must duplicate the theme first (to preserve a rollback) before applying.

2. **Retained section with dropped block types (Phase AB hardening):** A section type exists in both versions, but some block types that existed in V1's section definition have been removed in V2. If the merchant's blocks of those types have meaningful content, the content cannot be carried forward — it appears in `diff.conflicts` and sets `requiresDuplicateBeforeApply`.

Both scenarios populate `diff.conflicts[n].lostContent` and raise `requiresDuplicateBeforeApply` on the overall diff.

---

## 7. CAS Guard Design

The update flow uses a two-step CAS (compare-and-swap) protocol to prevent stale-preview application:

1. **Preview (GET):** The diff is computed, serialized, and hashed (`SHA-256(JSON.stringify(diff))`). The `diffHash` is returned alongside the diff.
2. **Apply (POST):** The client must supply `confirm_diff_hash` matching the hash computed at preview time. If the hash does not match (e.g., another update was applied between preview and apply), the gateway returns HTTP 409 `DIFF_HASH_MISMATCH`.

**Residual TOCTOU gap (documented, ARB-gated):** The CAS guard is TypeScript-level. Two concurrent POSTs with the same hash both pass before either write lands. The `idempotency_key` pre-check mitigates same-key retries but not same-hash concurrent submits. No merchant content is lost (both produce identical merged bundles), but a window for duplicate releases exists. Full closure requires a DB-level advisory lock inside `publish_theme_release` RPC — ARB-gated.

---

## 8. Rollback Model

Rollback reuses the existing Phase P rollback path with no modifications:

- The Phase AB `POST /:slug/update` route calls `publishVersionUpdateRelease` with `rollbackOfReleaseId = currentReleaseId`, so a rollback release always exists in `theme_releases`.
- The Phase C UI's Rollback button calls the pre-existing `POST /api/themes/:themeId/releases/:releaseId/rollback` proxy (Phase P route).
- Rolling back an update = rolling back to the release that was `is_current` before the update was applied. This is structurally equivalent to any other rollback — Phase AB adds no new rollback mechanism.

The Phase P RISK-TOCTOU-P02 (rollback CAS is TS-level only) applies here unchanged.

---

## 9. Tenancy Model

The gateway routes follow the same tenancy pattern as `media-library.ts`:

1. `resolveCustomUser` — rejects customer HS256 tokens (users_custom row lookup fails → 403).
2. `verifySiteOwnership` — rejects cross-tenant access (store_id in validated body vs JWT claim + DB check → 403).
3. All DB reads scoped to the verified `storeId` — never a caller-supplied value directly.
4. Idempotency pre-check: `store_id` is the FIRST filter on `theme_releases` before `idempotency_key`, so a cross-tenant idempotency key probe cannot reveal the existence of another store's release.

The merchant UI proxy routes use `resolveOwnedStoreId` (same-origin proxy) + `merchantApiFetch` (no direct DB) — consistent with the Phase X media-library proxy pattern.

---

## 10. Summary of New Files

| File | Lane | Role |
|------|------|------|
| `packages/theme-engine/src/theme-safe-update.ts` | A | Pure safe-update engine |
| `packages/theme-engine/test/theme-safe-update.test.ts` | A | 44 tests (41 lane-a + 1 hardening) |
| `services/api-gateway/src/routes/themes/theme-update-route.ts` | AB | Preview + apply route handlers |
| `services/api-gateway/src/__tests__/theme-update.test.ts` | AB | 18 gateway logic tests |
| `apps/merchant-control-plane/src/components/theme-editor/ThemeUpdatePanel.tsx` | C | Standalone update UI component |
| `apps/merchant-control-plane/src/app/api/themes/[themeId]/update-preview/route.ts` | C | Preview proxy |
| `apps/merchant-control-plane/src/app/api/themes/[themeId]/update/route.ts` | C | Apply proxy |
| `apps/merchant-control-plane/src/app/[store]/online-store/themes/update/page.tsx` | C | Server component wrapper |
| `apps/merchant-control-plane/src/app/[store]/online-store/themes/update/UpdatePageClient.tsx` | C | Client component |
| `apps/merchant-control-plane/tests/theme-editor-ab.test.mjs` | C | 95 static-contract tests |
