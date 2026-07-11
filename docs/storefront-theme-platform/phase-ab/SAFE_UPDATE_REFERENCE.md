# Safe Update Reference: Theme Version Migration

**Phase:** AB
**Package:** `@letbuyy/theme-engine`
**File:** `packages/theme-engine/src/theme-safe-update.ts`
**Date:** 2026-07-11

---

## 1. Overview

The safe-update engine is a **pure, deterministic** function that upgrades a merchant's ThemeDocument from one bundle version to another without silently losing any merchant-authored content.

**Law:** every setting value that cannot be carried into the new bundle either (a) appears in `diff.conflicts` with `lostContent` populated, or (b) is a design token or generated placeholder that intentionally should be replaced by the new bundle's defaults.

---

## 2. Exported API

```typescript
import {
  planThemeSafeUpdate,
  computeThemeUpdateDiff,
  classifyUpdateSetting,
  UpdateVersionRejectedError,
  UpdateDowngradeError,
} from '@letbuyy/theme-engine';
```

### `planThemeSafeUpdate(params): ThemeUpdateResult`

Full merge engine. Returns `updatedDoc` + `diff`.

```typescript
interface ThemeSafeUpdateParams {
  currentDocument: ThemeDocument;          // merchant's current document
  nextBundle: LiquidThemePackageBundle;   // new bundle to upgrade to
  options?: ThemeUpdateOptions;
}

interface ThemeUpdateOptions {
  preserveContent?: boolean;    // default true; false skips merchant content carry-forward
  migrationRegistry?: AppliedThemeSchemaMigration[];  // default []
}

interface ThemeUpdateResult {
  updatedDoc: ThemeDocument;
  diff: ThemeUpdateDiff;
  requiresDuplicateBeforeApply: boolean;
}
```

**Throws:** `UpdateVersionRejectedError` (unknown/future schema version), `UpdateDowngradeError` (target is older than current).

**Fail-closed:** calls `parseThemeDocument(merged)` before returning. If the merged document fails validation, the function throws rather than returning a corrupt document.

**Deterministic:** same `(currentDocument, nextBundle, options)` → identical output on every call. No `Date.now()` or `Math.random()` anywhere in this module.

### `computeThemeUpdateDiff(params): ThemeUpdateDiff`

Preview-only variant. Returns the diff without producing an `updatedDoc`. Useful for the `GET /:slug/update-preview` route where no document should be persisted.

Same gate checks as `planThemeSafeUpdate` (throws on unknown version or downgrade). Same conflict detection.

### `classifyUpdateSetting(key: string, value: unknown): SettingClass`

Classifies a single setting key+value pair. Used internally by the merge engine; exported for drift-parity testing against Phase O's `classifySetting`.

```typescript
type SettingClass =
  | 'merchant-content'
  | 'resource-binding'
  | 'token'
  | 'generated-placeholder';
```

**Classification order (important — W-binding check fires BEFORE token check):**

1. `isDynamicSourceDescriptor(value)` → `'resource-binding'` (W surface; checked FIRST)
2. `key in TOKEN_KEYS` → `'token'`
3. `key in EXPLICIT_RESOURCE_BINDING_KEYS` → `'resource-binding'`
4. key matches `*Handle`, `*Id`, `*_handle`, `*_id` suffix → `'resource-binding'`
5. `value === null || value === undefined || value === ''` → `'generated-placeholder'`
6. Otherwise → `'merchant-content'`

### `UpdateVersionRejectedError`

```typescript
class UpdateVersionRejectedError extends Error {
  name: 'UpdateVersionRejectedError';
  targetVersion: string;
  reason: 'unknown' | 'future';
}
```

Thrown when `nextBundle.schema_version` is not in `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS` (G4 gate).

### `UpdateDowngradeError`

```typescript
class UpdateDowngradeError extends Error {
  name: 'UpdateDowngradeError';
  fromVersion: string;  // current document's bundle_schema_version
  toVersion: string;    // target bundle's schema_version
}
```

Thrown when `compareSchemaVersions(next, current).direction === -1` (downgrade).

---

## 3. Diff Shape

```typescript
interface ThemeUpdateDiff {
  sections: ThemeUpdateDiffEntry[];
  requiresDuplicateBeforeApply: boolean;
  schemaMigrations: AppliedThemeSchemaMigration[];
  summary: {
    retained: number;
    added: number;
    removed: number;
    conflicts: number;
    sectionsWithLostContent: number;
  };
}

interface ThemeUpdateDiffEntry {
  action: 'retained' | 'added' | 'removed' | 'incompatible';
  sectionType: string;
  sectionLabel?: string;
  lostContent?: {
    settings?: Record<string, unknown>;  // merchant-content + resource-binding values from removed sections
    blocks?: ThemeDocumentBlock[];       // blocks whose type was removed from the section definition
  };
}
```

**`requiresDuplicateBeforeApply`** is `true` when any `diff.sections[n].lostContent` is non-undefined. This includes both:
- Sections removed from the new bundle that had merchant-authored content.
- Sections retained in the new bundle but whose block types were removed, when those blocks had meaningful content (hardening fix).

---

## 4. Version Flow

```
┌─────────────────────────────────────────────────────────────┐
│ planThemeSafeUpdate / computeThemeUpdateDiff                │
├─────────────────────────────────────────────────────────────┤
│  [1] G4 gate                                                │
│      isThemeBundleSchemaCompatible(nextBundle)              │
│      → UpdateVersionRejectedError if unknown/future         │
│                                                             │
│  [2] Direction check                                        │
│      compareSchemaVersions(next, current)                   │
│      direction = -1  → UpdateDowngradeError                 │
│      direction = 0   → NO-OP (updatedDoc = currentDocument) │
│      direction = 1   → proceed to merge                     │
│                                                             │
│  [3] G migration                                            │
│      migrateThemeTemplateSchemasWithRegistry(               │
│        currentDoc.templates, migrationRegistry)             │
│      → applies structural schema migrations to current      │
│        sections before merge (empty registry = no-op)       │
│                                                             │
│  [4] Per-section merge                                      │
│      For each section type in currentDocument:              │
│        classify settings → carry merchant-content + W       │
│        replace token + generated-placeholder from nextBundle│
│        carry blocks[] + children[] from current (T)         │
│        detect dropped block types (hardening)               │
│      For each section type NEW in nextBundle:               │
│        action = 'added' (not auto-inserted)                 │
│                                                             │
│  [5] Fail-closed gate (planThemeSafeUpdate only)            │
│      parseThemeDocument(merged)                             │
│      → throws if merged document fails validation           │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Content Preservation Rules

### 5.1 Section-level settings (U + Z surfaces)

| Class | Action |
|-------|--------|
| `merchant-content` | Carried forward into the merged section's settings |
| `resource-binding` | Carried forward (W: DynamicSourceDescriptor; or explicit/suffix key match) |
| `token` | Replaced from new bundle's section default settings |
| `generated-placeholder` | Replaced from new bundle's section default settings |

### 5.2 Block children (T surface)

When a section type is present in both versions, the entire `blocks[]` array — including nested `children[]` recursively up to `MAX_BLOCK_NESTING_DEPTH = 3` — is carried from the current document's section instance into the merged document.

Exception: `@app` sentinel blocks are gate-checked against the new bundle's `sectionAcceptsAppBlocks` for that section type. If the new bundle no longer accepts app blocks for a section, `@app` blocks are dropped (and this is treated as a content-loss situation — see §5.3).

All other block types (inline, reusable) are always carried forward unconditionally.

### 5.3 Dropped block types (retained sections — hardening)

When a section is retained but the new bundle's section definition removes a block type that was present in V1, and the merchant's blocks of that type have meaningful content (non-empty settings), the dropped blocks appear in `diff.conflicts[n].lostContent.blocks` and `requiresDuplicateBeforeApply` is set to `true`.

"Meaningful content" is defined as: the block has at least one setting classified as `merchant-content` or `resource-binding` (same `classifyUpdateSetting` used for section-level settings).

### 5.4 Locale replacement (Z surface)

`section_definitions.locales` and the document-level `locales` are always replaced from the new bundle. Locale-adjacent text that the merchant has authored (e.g., translated section labels stored in section `settings` as `merchant-content` values) is preserved via the normal settings carry-forward. The `locales` dict itself is not a preservation target — it is part of the bundle's definition, not the merchant's content.

---

## 6. Conflict Surfacing and the Duplicate-First Gate

### 6.1 When `requiresDuplicateBeforeApply` fires

- Any section in `diff.sections` with `lostContent !== undefined` (removed section with merchant content OR retained section with dropped block content).

### 6.2 What the caller must do

If `diff.requiresDuplicateBeforeApply === true`:

1. **Show a blocking warning** to the merchant explaining which sections have content that cannot be transferred.
2. **Offer "Duplicate first"** as the primary action — this creates a copy of the current theme (via the Phase Q duplicate route) so the merchant has a rollback point with all their content intact.
3. **Require explicit acknowledgement** (`conflictsAcknowledged = true`) before enabling the Apply Update button.
4. After the merchant acknowledges: apply the update. The engine will apply it with `lostContent` accurately reflecting what was lost (the content has not been silently dropped — it has been reported).

### 6.3 What `lostContent` contains

`lostContent.settings`: a `Record<string, unknown>` of the setting key+value pairs that were `merchant-content` or `resource-binding` classified but could not be carried forward (because the section was removed from the new bundle).

`lostContent.blocks`: an array of `ThemeDocumentBlock` objects that were present in the current document but whose block type was removed from the new bundle's section definition.

These values are for display/reporting only. They are not re-injected into the merged document.

---

## 7. CAS Guard Protocol

The gateway routes implement a two-step compare-and-swap to prevent stale-preview application:

```
Step 1 (GET /update-preview):
  computeThemeUpdateDiff(currentDoc, targetBundle)
  diffHash = SHA-256(JSON.stringify(diff))
  return { diff, compatible, requiresDuplicate, diff_hash: diffHash }

Step 2 (POST /update):
  planThemeSafeUpdate(currentDoc, targetBundle)       ← same inputs
  recompute diffHash
  if confirm_diff_hash !== diffHash → 409 DIFF_HASH_MISMATCH
  else → persist updatedDoc via publishReleaseSnapshot
```

**What the CAS guard prevents:** if the theme's active release changes between preview and apply (e.g., a concurrent update from another session), the hash will not match and the stale apply is rejected.

**Residual TOCTOU (ARB-gated):** two concurrent POST requests with the same valid hash (from the same prior preview) both pass the TypeScript hash check before either write lands. Full closure requires a DB-level advisory lock inside `publish_theme_release` RPC. See RISK-AB-01 in RISK_REGISTER.md.

---

## 8. Gateway Route Contracts

### `GET /v1/themes/:slug/update-preview`

| Parameter | Type | Source | Description |
|-----------|------|--------|-------------|
| `store_id` | UUID | query string | Verified via `verifySiteOwnership` |
| `target_package_version_id` | UUID | query string | ID of the `theme_package_versions` row to preview upgrading to |

**Response (200):**
```json
{
  "diff": {
    "sections": [...],
    "requiresDuplicateBeforeApply": false,
    "schemaMigrations": [],
    "summary": { "retained": 3, "added": 1, "removed": 0, "conflicts": 0, "sectionsWithLostContent": 0 }
  },
  "diff_hash": "a3b4c5d6...",
  "compatible": true
}
```

**Errors:** 400 (missing params), 403 (auth/ownership), 404 (no current release / package version not found), 422 (schema incompatible / downgrade).

### `POST /v1/themes/:slug/update`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `store_id` | UUID | Yes | Verified via `verifySiteOwnership` |
| `target_package_version_id` | UUID | Yes | Package version to upgrade to |
| `confirm_diff_hash` | string (64 hex chars) | Yes | SHA-256 of the diff from preview; CAS guard |
| `idempotency_key` | string (8–200 chars) | No | Idempotent apply — same key returns same release |
| `make_store_live` | boolean | No | Default `true`; set `false` to create the release without marking it current |
| `publish_message` | string (max 500 chars) | No | Release description |

**Response (200):**
```json
{
  "release": { "id": "...", "version": "...", "is_current": true, ... },
  "diff_summary": { "retained": 3, "added": 1, "removed": 0, "conflicts": 0 }
}
```

**Errors:** 400 (missing/invalid params), 403 (auth/ownership), 409 (stale diff hash), 422 (schema incompatible / downgrade), 500 (publish failure).

---

## 9. Merchant UI Proxy Contracts

### Same-origin proxy URL pattern

All proxy routes are under `/api/themes/[themeId]/`:

| Route | Method | Gateway path |
|-------|--------|-------------|
| `update-preview/route.ts` | GET | `GET /themes/:slug/update-preview?store_id=<storeId>&target_package_version_id=<versionId>` |
| `update/route.ts` | POST | `POST /themes/:slug/update` body `{ store_id, target_package_version_id, confirm_diff_hash, idempotency_key, publish_message }` |
| (Phase P) `releases/[releaseId]/rollback/route.ts` | POST | `POST /themes/:slug/releases/:releaseId/rollback` |

**Proxy response reshaping:** The `update-preview` proxy reshapes the gateway response from the internal diff shape to the UI-expected `ThemeUpdateDiff` shape:

```typescript
// Gateway shape  →  UI shape
payload.diff.sections                   →  diff.rows
payload.diff.requiresDuplicateBeforeApply → diff.requiresDuplicate
true (implied by non-422)              →  diff.compatible
payload.diff_hash                      →  diff.diffHash
```

---

## 10. Rollback

Rollback after a Phase AB update uses the Phase P rollback path unchanged:

```
POST /api/themes/:themeId/releases/:releaseId/rollback
```

Where `:releaseId` is the release ID of the version before the update was applied. The gateway's `rollbackRelease()` method (Phase P) handles the CAS guard and `publishReleaseSnapshot`.

The Phase AB update always stores `rollback_of_release_id` on the new release row so the UI can surface the correct `:releaseId` for the Rollback action.

**Rollback = revert.** After a rollback, the merchant's document, settings, and theme version are exactly as they were before the Phase AB update was applied. No Phase AB-specific rollback path exists.

---

## 11. Known Limitations and Risks

| Risk | Severity | Status |
|------|----------|--------|
| RISK-AB-01: TOCTOU duplicate releases on concurrent same-hash POST | LOW | OPEN; ARB-gated (DB advisory lock needed) |
| RISK-AB-02: Foreign WIP isolation test scope limited | LOW | OPEN; documented in PHASE_AB_SECURITY_REVIEW.md |
| RISK-AB-03: Api-gateway pre-existing failure documented by position not name | LOW | OPEN; use test names in future references |
| `custom_css` render path | NOT-CONNECTED | Phase AA validator built; `layout.tsx` call site not wired |
| `siteDrops` hydration | NOT-CONNECTED | Phase W gap unchanged |
| RISK-TOCTOU-Q01: plan-limit non-atomic count-then-insert | MEDIUM | OPEN; was targeted at Phase AB but remains unresolved (theme_instances schema not touched) |
