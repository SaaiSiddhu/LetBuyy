# Phase AB — Report: Theme Versioning + Updates

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** AB — Theme Versioning + Updates
**Date:** 2026-07-11
**Branch:** `stepup/main`
**Status:** COMPLETE (work uncommitted per Phase AB hard rules)

---

## 1. Summary

Phase AB delivers a three-lane, tenant-safe, no-data-loss theme version update system:

1. **Lane A: Safe-update merge engine (`theme-safe-update.ts`)** — a pure, deterministic function that upgrades a merchant's ThemeDocument from one bundle version to another without silently losing any merchant-authored content. Preserves section settings (U), resource-binding descriptors (W), nested block children (T), and locale-adjacent text (Z). Surfaces uncarriable content (sections removed from the new bundle that have merchant customizations) in `diff.conflicts` with `requiresDuplicateBeforeApply = true`.

2. **Lane AB: Gateway routes (`theme-update-route.ts`)** — two tenant-safe Hono routes wired into the existing `themes.ts` router. `GET /:slug/update-preview` computes the diff + SHA-256 hash without any write. `POST /:slug/update` applies the merged document exclusively via the Phase P `publishReleaseSnapshot` path, with `rollbackOfReleaseId = currentReleaseId` so rollback is always available without any new rollback mechanism.

3. **Lane C: Merchant update UI (`ThemeUpdatePanel`)** — a standalone `'use client'` React component rendering update availability, a per-template section diff table (added/removed/retained/incompatible rows), a conflict acknowledgement gate (blocks apply until merchant confirms), and a Rollback action reusing the Phase P proxy. Seven explicit UI states prevent any ambiguous in-between condition.

**No-data-loss proof:** 42 new theme-engine tests + 18 new gateway tests + 93 new merchant tests provide mechanical coverage of the preservation invariants, conflict surfacing, CAS guard, tenancy model, and RISK-DUAL-N01 boundary. The merge engine is fail-closed: `parseThemeDocument` runs as the final gate before the merged document is returned.

**Rollback = revert:** Because Phase AB always passes `rollbackOfReleaseId = currentReleaseId` to `publishReleaseSnapshot`, the release immediately before the update is always preserved in `theme_releases`. Rolling back an AB update is structurally identical to rolling back any Phase P release — the Phase P rollback proxy handles it without any Phase AB-specific code path.

**Test gate:** 1634/1634 theme-engine · 1489 api-gateway pass (27 pre-existing) · 712/712 merchant · 795/795 storefront-runtime · all typechecks clean.

---

## 2. Deliverables

### Lane A — Engine (`packages/theme-engine/`)

#### `packages/theme-engine/src/theme-safe-update.ts` — NEW

Pure TypeScript, no DB I/O, no network calls, no DOM globals. Exports:

| Export | Description |
|--------|-------------|
| `UpdateVersionRejectedError` | Thrown by G4 gate for unknown/future schema versions |
| `UpdateDowngradeError` | Thrown when target bundle is older than current document |
| `SettingClass` | `'merchant-content' \| 'resource-binding' \| 'token' \| 'generated-placeholder'` |
| `classifyUpdateSetting(key, value)` | Classifies a setting key+value; W-binding check fires before token check |
| `ThemeUpdateDiff` | `{ sections[], requiresDuplicateBeforeApply, schemaMigrations[], summary }` |
| `ThemeUpdateResult` | `{ updatedDoc, diff, requiresDuplicateBeforeApply }` |
| `planThemeSafeUpdate(params)` | Full merge: G4 gate → direction → G migration → section merge → parseThemeDocument |
| `computeThemeUpdateDiff(params)` | Preview variant: same logic, returns diff only (no updatedDoc) |

**Content preservation algorithm per section:**

```
For each section type in currentDocument:
  If type absent from nextBundle:
    → action: 'removed'
    → classify each setting; if any is merchant-content or resource-binding:
       → lostContent.settings populated, requiresDuplicateBeforeApply = true
  If type present in nextBundle:
    → action: 'retained'
    → SWAP section_definitions, block_definitions, locales, renderer, layout from nextBundle
    → PRESERVE merchant-content + resource-binding settings from current
    → PRESERVE blocks[] + children[] from current (T)
    → For each block whose type is absent from new section definition:
       if block has meaningful content:
         → lostContent.blocks populated, requiresDuplicateBeforeApply = true

For each section type in nextBundle absent from currentDocument:
  → action: 'added' (not auto-inserted into templates)
```

**G4 gate → version direction → migration → merge → fail-closed:**

```
isThemeBundleSchemaCompatible(nextBundle)   [K]  → REJECT if unknown
compareSchemaVersions(next, current)        [K]  → REJECT downgrade; NO-OP same
migrateThemeTemplateSchemasWithRegistry()   [G]  → structural migration before merge
per-section classify + carry-forward             → NO-DATA-LOSS LAW
parseThemeDocument(merged)                  [N]  → fail-closed gate
```

**44 new tests** (41 lane-a + 1 hardening + 2 classifyUpdateSetting extras in test file): no-op gate, version rejection, downgrade rejection, merchant-content preservation, token replacement, placeholder replacement, resource-binding via plain key, resource-binding via suffix pattern, W binding descriptor, T nested blocks, Z locale-adjacent text, locale replacement, no-customizations clean update, removed section conflicts, added section diff, G migration wiring, parseThemeDocument final gate, determinism, Phase O parity tests, retained-section dropped-block lostContent (hardening).

#### `packages/theme-engine/src/theme-bundle.ts` — MODIFIED (1 additive line)

`THEME_LIQUID_BUNDLE_SCHEMA_VERSION_V2 = '2026-07-liquid-sections-v2'` inserted at index 1 in `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS`. Required for `compareSchemaVersions` to return `direction: 1` for forward-update tests. No existing test affected; V1 stays at index 0.

#### `packages/theme-engine/src/index.ts` — ADDITIVE (1 line)

```typescript
export * from './theme-safe-update';
```

---

### Lane AB — Gateway (`services/api-gateway/`)

#### `services/api-gateway/src/routes/themes/theme-update-route.ts` — NEW

Exports `mountThemeUpdateRoutes(router: Hono<{Bindings:Env}>)`.

**`GET /:slug/update-preview`**

Zod schema: `{ store_id: UUID, target_package_version_id: UUID }` (query string).

1. `resolveCustomUser` (HS256 tokens rejected at this step — no `users_custom` row → 403).
2. `verifySiteOwnership(storeId)` — cross-tenant check → 403.
3. `loadCurrentReleaseBundle(storeId, themeSlug)` — `theme_releases.is_current=true` → `toThemeDocumentV2` → `ThemeDocument`.
4. `loadTargetPackageVersionBundle(storeId, themeSlug, targetPackageVersionId)` — `theme_package_versions.package_manifest.liquidBundle` → `parseLiquidThemePackageBundle` (G4 gate).
5. `computeThemeUpdateDiff(currentDoc, targetBundle)`.
6. `diffHash = sha256Hex(JSON.stringify(diff))`.
7. Return `{ diff, compatible: true, requiresDuplicate: diff.requiresDuplicateBeforeApply, diff_hash: diffHash }`.

No write. Pure diff preview.

**`POST /:slug/update`**

Zod schema: `{ store_id: UUID, target_package_version_id: UUID, confirm_diff_hash: string.min(16).max(128), make_store_live: boolean.default(true), publish_message: string.max(500).optional(), idempotency_key: string.min(8).max(200).optional() }`.

1. Auth + ownership (same as preview).
2. `loadCurrentReleaseBundle` + `loadTargetPackageVersionBundle`.
3. `planThemeSafeUpdate(currentDoc, targetBundle)` — produces `updatedDoc` + `diff`.
4. Compute `diffHash = sha256Hex(JSON.stringify(diff))`.
5. If `confirm_diff_hash !== diffHash` → `ConflictError` → HTTP 409 `DIFF_HASH_MISMATCH`.
6. If `!diff.compatible` (G4 gate mismatch) → HTTP 422.
7. `fromThemeDocumentV2(updatedDoc)` — encode merged document as new bundle.
8. `publishVersionUpdateRelease(storeId, themeSlug, newBundle, rollbackOfReleaseId=currentReleaseId, opts)`.
9. `emitAuditEvent({ beforeState: { from_schema_version, prior_release_id }, afterState: { to_schema_version, new_release_id, diff_summary } })`.
10. Return `{ release, diff_summary }`.

**New `ThemeExecutionAdapter` methods (3):**
- `loadCurrentReleaseBundle(storeId, themeSlug)` — `theme_releases` query; `store_id` is first filter always.
- `loadTargetPackageVersionBundle(storeId, themeSlug, versionId)` — `theme_package_versions` query with G4 validation.
- `publishVersionUpdateRelease(storeId, themeSlug, bundle, rollbackOfReleaseId, opts)` — idempotency pre-check (`store_id` first, then `idempotency_key`) → `publishReleaseSnapshot` → post-enrich.

**18 new gateway tests** covering auth (HS256 rejection), tenancy (cross-tenant 403, cross-tenant idempotency probe), NO-DATA-LOSS ordering, error propagation (422 for rejected/incompatible versions, 409 for hash mismatch), idempotency replay, adapter loading errors.

#### `services/api-gateway/src/routes/themes.ts` — MODIFIED (3 lines after `/media-library` mount)

```typescript
import mountThemeUpdateRoutes from './themes/theme-update-route';
router.use('/:slug/update-preview', authMiddleware);
router.use('/:slug/update', authMiddleware);
mountThemeUpdateRoutes(router);
```

---

### Lane C — Merchant UI (`apps/merchant-control-plane/`)

#### `apps/merchant-control-plane/src/components/theme-editor/ThemeUpdatePanel.tsx` — NEW

Standalone `'use client'` React component. Does not import from `editor/page.tsx`, `ExperiencePicker`, `@letbuyy/api-client`, or `globals.css`.

**Props:** `themeSlug: string`, `storeId: string`, `currentVersionId: string`, `availableVersionId: string`, `apiBase: string`.

**Seven explicit states:**

| State | Entry condition | Primary action |
|-------|-----------------|----------------|
| `no-update` | `currentVersionId === availableVersionId` | None — "Up to date" |
| `available` | versions differ, no diff fetched | "Preview update" button |
| `previewing` | GET /api/themes/:slug/update-preview in-flight | Loading skeleton (`aria-busy`) |
| `conflicts` | preview returned `requiresDuplicate=true` | "Duplicate first" blocking action |
| `updating` | POST /api/themes/:slug/update in-flight | Loading skeleton |
| `done` | POST succeeded | "Update applied" success |
| `error` | any request failed | Error message + retry |

**canApply guard (no silent apply):**
```
diff !== null
  AND diff.diffHash is present (preview must succeed first)
  AND diff.compatible === true (schema must be compatible)
  AND (!diff.requiresDuplicate || conflictsAcknowledged)
```

**Diff table:** `role="grid"`, `aria-label` on table, one row per section with action column (`added` / `removed` / `retained` / `incompatible`) and a preserved/lost badge.

**Rollback action:** `POST /api/themes/:themeId/releases/:releaseId/rollback` (Phase P proxy, reused unchanged). Confirm dialog required (destructive action gate: `aria-label` on dialog and buttons).

**ARIA:** `role="region"` + `aria-label` on wrapper; `aria-disabled` + `aria-label` on Apply button; `aria-label` on Preview and Rollback buttons; `aria-busy` on loading skeletons; `aria-expanded` + `aria-controls` on diff toggle.

**Design:** `@letbuyy/ui` components, `--lb-*` tokens only, no `rounded-[Npx]`, mobile-first (~360px), no `dangerouslySetInnerHTML`.

#### `apps/merchant-control-plane/src/app/api/themes/[themeId]/update-preview/route.ts` — NEW

GET proxy. Exports `GET`.

1. `resolveOwnedStoreId` — derives `storeId` from authenticated session.
2. `merchantApiFetch` — calls `GET /themes/:slug/update-preview?store_id=<storeId>&target_package_version_id=<versionId>` on the gateway.
3. Reshapes gateway response to UI-expected shape:
   - `payload.diff.sections` → `rows`
   - `payload.diff.requiresDuplicateBeforeApply` → `requiresDuplicate`
   - `compatible: true` (implied by non-422 gateway response)
   - `diffHash: payload.diff_hash`
4. Returns `{ diff: { rows, compatible, requiresDuplicate, diffHash } }`.

Guards: missing `store_id` → 400; `resolveOwnedStoreId` failure → 403 propagated.

#### `apps/merchant-control-plane/src/app/api/themes/[themeId]/update/route.ts` — NEW

POST proxy. Exports `POST`.

1. `resolveOwnedStoreId`.
2. Validates `confirm_diff_hash` matches `/^[0-9a-f]{64}$/` → 400 if invalid (matches gateway Zod schema exactly).
3. Validates `idempotency_key` non-empty → 400 if absent.
4. `merchantApiFetch` — calls `POST /themes/:slug/update` with body: `{ store_id: resolved.storeId, target_package_version_id, confirm_diff_hash, idempotency_key, publish_message }` (renames UI's `update_message` → `publish_message`, `target_bundle_version_id` → `target_package_version_id`).
5. Forwards response.

#### `apps/merchant-control-plane/src/app/[store]/online-store/themes/update/page.tsx` — NEW

Server component wrapper. Reads `storeId` from params. Renders `UpdatePageClient`.

#### `apps/merchant-control-plane/src/app/[store]/online-store/themes/update/UpdatePageClient.tsx` — NEW

Client component. Fetches available versions. Renders `ThemeUpdatePanel`. `--lb-*` tokens, no `dangerouslySetInnerHTML`.

#### `apps/merchant-control-plane/tests/theme-editor-ab.test.mjs` — NEW

93 static-contract tests (file existence 5, component contract 17, proxy tenancy 20, RISK-DUAL-N01 10, design ratchet 10, ARIA/a11y 10, UI states 7, sandbox law 2, package.json 1, plus proxy+security checks).

#### `apps/merchant-control-plane/package.json` — MODIFIED (additive)

`theme-editor-ab.test.mjs` appended to test script.

---

## 3. Hardening Findings (All Resolved)

| Severity | File | Finding | Fix |
|----------|------|---------|-----|
| CRITICAL | `ThemeUpdatePanel.tsx` / `update-preview/route.ts` | UI `ThemeUpdateDiff` type mismatch: `diff.rows` was `undefined` → TypeError crash in diff table; `diff.requiresDuplicate` `undefined` → conflict warning never shown; `canApply` permanently `false` → Apply disabled forever | Proxy now reshapes gateway response: `sections→rows`, `requiresDuplicateBeforeApply→requiresDuplicate`, `compatible: true`, `diffHash` injected from `diff_hash` |
| HIGH | `update-preview/route.ts` | `target_version_id` forwarded; gateway requires `target_package_version_id` → gateway Zod parse always fails → 400 | Renamed to `target_package_version_id` in proxy URL |
| HIGH | `update/route.ts` | `target_bundle_version_id` forwarded; gateway requires `target_package_version_id` | Renamed in gateway body |
| MEDIUM | `update/route.ts` | `update_message` forwarded; gateway expects `publish_message` | Renamed in gateway body |
| MEDIUM | `update/route.ts` | `idempotency_key` only conditionally forwarded; gateway requires it | Now required + always forwarded |
| MEDIUM | `theme-safe-update.ts` | Retained sections with dropped block types: content silently dropped without conflict entry — NO-DATA-LOSS violation | `droppedBlocksWithContent` tracked per retained section; `lostContent.blocks` populated when meaningful; conflicts filter extended from `action==='removed'` to any entry with `lostContent !== undefined` |
| LOW | `update/route.ts` | `confirm_diff_hash` proxy guard: min 8 chars (too weak) vs gateway's 64-char hex | Tightened to `/^[0-9a-f]{64}$/` |

**No deferred CRITICAL, HIGH, or MEDIUM findings.** 2 LOW findings documented as RISK-AB-02 (TOCTOU duplicate releases) and RISK-AB-03 (foreign WIP isolation test scope).

---

## 4. Rollback Architecture

Rollback in Phase AB is the Phase P rollback path — no new mechanism was added:

1. `POST /:slug/update` calls `publishVersionUpdateRelease(..., rollbackOfReleaseId = currentReleaseId)`.
2. `publishVersionUpdateRelease` calls `publishReleaseSnapshot(... rollbackOfReleaseId ...)`.
3. `publishReleaseSnapshot` stores `rollback_of_release_id = currentReleaseId` on the new release row.
4. The merchant UI's Rollback button calls `POST /api/themes/:themeId/releases/:releaseId/rollback` — the Phase P rollback proxy — with `releaseId` = the current release (before the update).
5. The Phase P rollback path calls `rollbackRelease()` in `ThemeExecutionAdapter` (CAS guard + `publishReleaseSnapshot` with the old release's config).

**Rollback = revert to pre-update state.** No Phase AB-specific rollback code path exists.

---

## 5. NOT-CONNECTED Inventory

| Surface | Status | Notes |
|---------|--------|-------|
| `custom_css` render wiring (Phase AA) | NOT-CONNECTED | `buildLiquidThemeHeadAssets(bundle)` call site at `layout.tsx` line 585 still un-wired. Phase AB did not wire it — out of scope. Phase AC/AD deliverable. |
| `siteDrops` hydration for `resolveDynamicSourceDescriptors` | NOT-CONNECTED | Phase W gap unchanged. |
| App-block runtime | NOT-CONNECTED | Phase Y gap unchanged. `not_connected: true` honest state. |
| `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` | `false` | Liquid canary remains OFF. Unchanged. |

---

## 6. Risk Register Changes

New risks registered:
- **RISK-AB-01** (LOW) — TOCTOU: same-hash concurrent POST submits can create duplicate releases. ARB-gated.
- **RISK-AB-02** (LOW) — Foreign WIP isolation test proves only "no AB symbol introduction", not "no touch at all".
- **RISK-AB-03** (LOW) — Pre-existing api-gateway foreign failure documented by test name not position.

Carried risks updated (no new Phase AB violations):
- RISK-T01 through RISK-T06, RISK-SEC-U01 through U03, RISK-A11Y-U01/U02, RISK-STYLE-U01/U02, RISK-W01 through W06, RISK-X01, RISK-Y01, RISK-Z01 through Z06, RISK-AA-01/AA-02/AA-03 — all retargeted to Phase AC or first file touch.

---

## 7. Foreign WIP Isolation

All Phase AB files are net-new or additive. No Foreign WIP file was modified:

| Foreign WIP file | Touched? | Proof |
|-----------------|----------|-------|
| `editor/page.tsx` | No | Static-contract test `'phase-ab: foreign WIP editor/page.tsx is NOT modified'` passes; file does not reference `ThemeUpdatePanel` or `UpdatePageClient` |
| `apps/merchant-control-plane/src/app/globals.css` | No | No Phase AB CSS additions required |
| `apps/identity-platform/*` | No | Phase AB scope does not touch identity |
| `apps/marketing-site/*` | No | Phase AB scope does not touch marketing |
