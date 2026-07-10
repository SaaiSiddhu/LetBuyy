# Phase X Report — Files & Media Library

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** X — Files & Media Library
**Date authored:** 2026-07-11
**Branch:** `stepup/main`
**Author scope:** Phase X delivers (1) a server-side MIME allowlist blocking SVG and executables at the shared upload endpoint, (2) a tenant-safe media-library gateway sub-router for theme-editor picker queries, (3) a `MediaLibrary` modal grid picker with keyboard accessibility and upload affordance, (4) an `ImagePickerControl` for the `image` field type that wraps existing upload behavior with a "Browse Library" path, and (5) a Browse Library button in `VideoControl` for the `video` field type. Storage CONNECTED (R2 via `c.env.R2_BUCKET.put`; Supabase `media` table via `verifySiteOwnership`-gated queries). No new database migrations. No SECURITY DEFINER RPCs modified. No frozen apps touched. Rollback = revert all Phase X commits.

---

## HUMAN REVIEW GATE — Read Before Deploying

Phase X touches `apps/merchant-control-plane/package.json` (test script addition — `theme-editor-x.test.mjs` appended). This file carries prior user modifications; the hunk appends one entry and does not conflict. **This change MUST NOT be committed without review of the hunk against surrounding foreign WIP.**

No new database migrations. The MIME allowlist change to `upload.ts` is backward-compatible — all previously supported types (`image/jpeg`, `image/png`, `image/webp`, `image/gif`, `video/mp4`, `video/webm`, `video/quicktime`, `model/gltf-binary`, `model/gltf+json`) remain allowed. A one-time review of live upload MIME distributions before production rollout is recommended (RISK-X01 operational note).

---

## 1. What Shipped

### 1.1 New Files

| File | Lane | Purpose |
|------|------|---------|
| `services/api-gateway/src/lib/upload-mime.ts` | A | MIME allowlist constants; `validateUploadMime(file)` function; SVG policy documentation |
| `services/api-gateway/src/routes/themes/media-library.ts` | A | Hono sub-router; `GET /v1/themes/media-library`; tenant-safe; cursor-paginated |
| `services/api-gateway/src/__tests__/media-library-x.test.ts` | A | 28 cross-tenant + MIME tests (X-T01..X-T28) |
| `apps/merchant-control-plane/src/app/api/stores/[store]/themes/media-library/route.ts` | B | Thin raw-fetch proxy; `resolveOwnedStoreId`; `q=` param alignment |
| `apps/merchant-control-plane/src/components/theme-editor/controls/MediaLibrary.tsx` | B | Modal grid picker; ARIA; keyboard nav; upload affordance; NOT-CONNECTED graceful degradation |
| `apps/merchant-control-plane/src/components/theme-editor/controls/ImagePickerControl.tsx` | B | Wraps `ImageInput` + Browse Library button; `isUnsafeUrl` guard on library selection |
| `apps/merchant-control-plane/tests/theme-editor-x.test.mjs` | B | 92 Phase X static-contract tests |

### 1.2 Modified Files

| File | Change | WIP? |
|------|--------|------|
| `services/api-gateway/src/routes/upload.ts` | Import `validateUploadMime`; call before size check; UUID full entropy | Clean |
| `services/api-gateway/src/routes/themes.ts` | `authMiddleware` + `router.route('/media-library', …)` before resource-search block | Clean |
| `apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx` | Import `ImagePickerControl`; `case 'image':` renders `ImagePickerControl` (4 lines) | Clean |
| `apps/merchant-control-plane/src/components/theme-editor/controls/VideoControl.tsx` | Import `MediaLibrary`; Browse Library button + `handleLibrarySelect` with `isUnsafeUrl` guard | Clean |
| `apps/merchant-control-plane/src/components/theme-editor/controls/controls.module.css` | New Phase X classes: `browseLibraryBtn`, `mediaLibrary*` (all `--lb-*` tokens, 2-col grid) | Clean |
| `apps/merchant-control-plane/package.json` | `theme-editor-x.test.mjs` appended to test script | WIP (foreign, additive) |

### 1.3 FROZEN / Untouched Files

| File | Reason |
|------|--------|
| `services/api-gateway/src/index.ts` | FOREIGN WIP — media-library mounted in `themes.ts`, not `index.ts` |
| `packages/api-client/src/index.ts` | FOREIGN WIP — proxy uses raw `merchantApiFetch`; no api-client edit |
| `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` | FOREIGN WIP |
| `apps/merchant-control-plane/src/app/globals.css` | FOREIGN WIP — all Phase X styles in `controls.module.css` |
| `apps/merchant-control-plane/src/components/theme-editor/ExperiencePicker.tsx` | FOREIGN WIP |
| `packages/theme-engine/src/theme-renderer.ts` | Unchanged — RISK-W06 (block-level binding resolution) not addressed in Phase X |
| `packages/theme-engine/src/dynamic-source-binding.ts` | Unchanged — RISK-W01 (BINDING_BLOCKED_KEYS parity) not addressed in Phase X |
| `packages/theme-engine/src/theme-document.ts` | Unchanged — RISK-T06 (dead export) not addressed in Phase X |

---

## 2. Upload MIME Gate

### 2.1 Design

`services/api-gateway/src/lib/upload-mime.ts` exports `validateUploadMime(file): { ok, error }`. The allowlist covers exactly the types that production themes legitimately use: JPEG/PNG/WebP/GIF for images, MP4/WebM/QuickTime for video, and GLTF variants for 3D. SVG is rejected unconditionally.

**SVG policy:** Cloudflare Workers have no DOM parser. Regex/text stripping of SVG `<script>`, event handlers (`onload`, `onerror`), `<use xlink:href>`, and `<foreignObject>` is known-bypassable. All legitimate theme-image use cases are covered by raster formats. Future SVG support requires a separate upload pipeline with server-side DOMPurify (Node.js worker), not the CF Worker itself.

### 2.2 Integration in `upload.ts`

```
POST /v1/upload
  → verifyUploadStoreOwnership
  → extract file from FormData
  → validateUploadMime(file)   ← Phase X addition (before size check)
    if !ok → 400 MIME_NOT_ALLOWED
  → per-kind size check (10MB / 100MB / 50MB)
  → R2_BUCKET.put(key, file.stream(), {...})
  → media table record create
```

Approximately 7 lines changed. All pre-existing upload paths (image, video, 3D model) continue to work identically. The only change for previously-allowed types is the early validation before the size check — which passes immediately for all allowed types.

### 2.3 Key entropy improvement

Key path: `${folder}/${auth.user.id}/${Date.now()}-${crypto.randomUUID().replace(/-/g, '')}.${ext}`. The UUID is now 122 bits (was 32 bits via `.slice(0, 8)`). CDN key enumeration is not feasible within any practical window.

---

## 3. Media-Library Sub-Router

### 3.1 Route contract

```
GET /v1/themes/media-library
?store_id=<uuid>                    (required)
&type=image|video|all               (optional; default all)
&q=<string, max 200 chars>          (optional; ilike on filename OR original_name)
&cursor=<string>                    (optional; opaque pagination cursor)
&limit=<int, 1–100, default 20>     (optional)

Auth:   authMiddleware (global) + resolveCustomUser + verifySiteOwnership
Errors: 400 (missing/invalid store_id) · 403 (auth fail | cross-tenant) · 500 (DB error)

Response 200:
{
  "items": [
    {
      "id": "uuid",
      "filename": "banner.jpg",
      "url": "https://cdn.letbuyy.com/...",
      "thumbnail_url": "https://cdn.letbuyy.com/...",
      "mime_type": "image/jpeg",
      "size_bytes": 245600,
      "alt_text": "...",
      "media_type": "image",
      "created_at": "2026-07-11T..."
    }
  ],
  "nextCursor": "..." | null
}
```

### 3.2 Search sanitization

PostgREST `.or()` filter: `filename.ilike.%${safe}%,original_name.ilike.%${safe}%`. The `safe` variable strips `%`, `(`, `)`, `,`, `'`, `\` from the raw query before embedding. Single quotes and backslashes were added in the hardening pass to close the remaining PostgREST injection edge-case characters.

### 3.3 Route order in `themes.ts`

`/media-library` is registered before the Phase W `/resource-search` block and before all `/:slug/*` catch-alls, following the static-path-first convention established at Phase W.

---

## 4. MediaLibrary Modal Picker

### 4.1 Fetch chain

```
MediaLibrary.tsx → raw fetch to /api/stores/{storeName}/themes/media-library
                 → proxy route.ts → resolveOwnedStoreId → merchantApiFetch
                 → gateway /v1/themes/media-library?store_id={verified}&...
```

The browser never supplies `store_id`. The proxy always uses `resolved.storeId`.

### 4.2 ARIA and accessibility

| ARIA pattern | Implementation |
|---|---|
| `role="dialog"` + `aria-modal="true"` | Modal root element |
| `aria-labelledby` | Points to dialog title |
| `role="grid"` | Thumbnail grid container |
| `role="gridcell"` | Each thumbnail cell |
| `aria-label="Select ${filename}"` | Per-cell accessible name |
| `aria-hidden="true"` | On the `<img>` inside each cell — prevents double-announcement |
| Focus-trap (Tab) | Implemented; focus stays inside modal while open |
| Arrow-key navigation | ArrowRight/Left/Down/Up; uses `gridCols` state (not hardcoded) |
| Enter / Space to select | Fires `onSelect(url)` |
| Escape to close | Fires `onClose()` |

**Keyboard navigation fix (hardening):** `cellRefs` (`useRef<(HTMLDivElement|null)[]>([])`) with `ref` assigned to each gridcell. A `useEffect` on `activeIndex` calls `cellRefs.current[activeIndex]?.focus()` so DOM focus tracks the highlighted cell. Screen readers announce the newly-highlighted item on arrow-key navigation.

**GRID_COLS fix (hardening):** A `ResizeObserver` on the grid element reads `getComputedStyle(el).gridTemplateColumns` to count actual rendered column tracks. The `gridCols` state (default 2, becomes 3 at the 400 px CSS breakpoint) drives `ArrowDown` / `ArrowUp` step arithmetic. This prevents the pre-hardening bug where `ArrowDown` from item 0 jumped to item 2 instead of item 3 on desktop-width viewports.

### 4.3 Upload affordance

The file input in `MediaLibrary.tsx` posts to the existing `/api/stores/{storeName}/upload` proxy. This proxy already calls `apiClient.media.create()` on successful upload, so no new `media.create` call is needed in `MediaLibrary.tsx`. The grid refreshes after upload to show the newly-uploaded file.

### 4.4 NOT-CONNECTED graceful degradation

If the gateway returns 404, 502, or 503 (e.g. Lane A not deployed yet, or gateway error), `MediaLibrary.tsx` displays an error state with a retry prompt. The editor does not crash; the `ImagePickerControl` and `VideoControl` remain functional for manual URL entry.

### 4.5 SVG client-side guard

`validateUploadFile()` in `MediaLibrary.tsx` rejects files with `type === 'image/svg+xml'` or `type.startsWith('image/svg')` with an `UPLOAD-SAFETY` error message before any fetch is issued. The file input `accept` attribute also excludes `image/svg+xml`. Both are defence-in-depth; the gateway MIME gate is authoritative.

---

## 5. ImagePickerControl and VideoControl

### 5.1 `ImagePickerControl` backward compat

`ImagePickerControl` is a drop-in replacement for the Phase M frozen `ImageInput`. Props are identical: `{ label, value, onChange, storeName, helpText }`. The URL text input and `cloud_upload` file button behave byte-identically to the pre-Phase-X `ImageInput`. The only new affordance is the "Browse Library" button, which requires `storeName` to be non-empty — if `storeName` is absent, the button is not rendered and behavior is identical to pre-X.

### 5.2 `SchemaFormRenderer` patch

```typescript
// Before Phase X (case 'image' inline block):
case 'image':
  return <ImageInput label={...} value={...} onChange={...} storeName={...} helpText={...} />;

// After Phase X (4-line patch):
case 'image':
  return <ImagePickerControl label={...} value={...} onChange={...} storeName={...} helpText={...} />;
```

`ImageInput` remains as an unexported helper inside `SchemaFormRenderer.tsx` or is moved into `ImagePickerControl.tsx`. No other cases changed.

### 5.3 RISK-DUAL-N01 compliance

`ImagePickerControl.onChange` and `VideoControl.handleLibrarySelect` emit only a CDN URL string. The URL is indistinguishable from a manually-typed URL from the perspective of `applyChange()` upstream — no descriptor object, no library metadata, no media id. RISK-DUAL-N01 is preserved.

### 5.4 `isUnsafeUrl` guard (hardening)

Both `ImagePickerControl.handleLibrarySelect` and `VideoControl.handleLibrarySelect` call `isUnsafeUrl(url)` before `onChange(url)`. This mirrors the `handleUrlChange` path that already had this guard. The guard is defence-in-depth since R2 URLs are always HTTPS CDN URLs; but it closes the gap for any hypothetical `javascript:` or `data:` URI that might exist in the `media` table from a non-R2 path.

---

## 6. Storage Reality — CONNECTED / NOT-CONNECTED

| Storage piece | Status |
|---|---|
| R2 upload: `c.env.R2_BUCKET.put(key, stream, {...})` | **CONNECTED** — existing in `upload.ts` |
| R2 public CDN URL: `ASSET_PUBLIC_BASE_URL` env var | **CONNECTED** — existing; media rows store the CDN URL |
| Local dev fallback (no R2 binding): inline base64 data URI | **CONNECTED** — existing behavior when `R2_BUCKET` binding absent |
| `media` table SELECT: `GET /v1/themes/media-library` | **CONNECTED** — Phase X sub-router queries `media` table with `verifySiteOwnership` gate |
| `media` table SELECT (general list): `GET /v1/media` | **CONNECTED** — pre-existing route unchanged |
| `media_assets` secondary mirror on upload | **NOT-CONNECTED** (optional, silently null-safe): `isOptionalMediaAssetWriteError` swallows schema-cache errors if `media_assets` table is absent |
| Thumbnail generation: `thumbnail_url` in media rows | **NOT-CONNECTED** — `thumbnail_url` is stored by the upload caller if provided; no server-side thumbnail generation; `MediaLibrary.tsx` falls back to `url` when `thumbnail_url` is null |

---

## 7. Phase X Findings Summary

### 7.1 Findings from code review (8 total, all fixed before close)

| Severity | Finding | Status |
|---|---|---|
| HIGH (×2) | Search parameter name mismatch: proxy forwarded `search=` but gateway read `q=`; search silently returned unfiltered results | FIXED — proxy renamed to `q=`; `MediaLibrary.tsx` also uses `q=` |
| MEDIUM | Grid keyboard nav (`ArrowDown/Up`) updated `activeIndex` state but never called `.focus()`; screen readers did not follow navigation | FIXED — `cellRefs` + `useEffect` now calls `.focus()` on `activeIndex` change |
| MEDIUM | `GRID_COLS = 2` hardcoded but CSS switches to 3 columns at 400 px; `ArrowDown` arithmetic wrong on desktop viewports | FIXED — `ResizeObserver` drives `gridCols` state; arithmetic uses state, not constant |
| LOW | `handleLibrarySelect` in `VideoControl` and `ImagePickerControl` bypassed `isUnsafeUrl` check | FIXED — guard added to both `handleLibrarySelect` functions |
| LOW | PostgREST search string stripped `%()`, but left `'` and `\` unstripped | FIXED — regex extended: `/[%(),'\\]/g` |
| LOW | `crypto.randomUUID().slice(0, 8)` — only 32 bits of R2 key entropy | FIXED — `crypto.randomUUID().replace(/-/g, '')` — 122 bits |
| LOW | `<img>` inside `gridcell` had `alt={filename}` while `gridcell` had `aria-label="Select ${filename}"` — double-announcement | FIXED — `aria-hidden="true"` added to `<img>` |

**Hardening: ALL 8 findings fixed before phase close. No deferred findings from Phase X.**

### 7.2 New open risks introduced by Phase X

| Risk ID | Severity | One-line summary |
|---|---|---|
| RISK-X01 | LOW | R2 key path is `${userId}/…` not `${siteId}/…`; cross-store isolation is API-level only |

### 7.3 Deferred Phase T / U / W risks (unchanged)

RISK-T01, RISK-T02, RISK-T03, RISK-T04, RISK-T05, RISK-T06, RISK-SEC-U01, RISK-SEC-U02, RISK-SEC-U03, RISK-A11Y-U01, RISK-A11Y-U02, RISK-STYLE-U01, RISK-STYLE-U02, RISK-W01, RISK-W02, RISK-W03, RISK-W04, RISK-W05, RISK-W06 all carry unchanged to Phase Y or the next file-relevant touch. See RISK_REGISTER.md for per-risk Phase X notes.

---

## 8. Gate Summary

| Gate | Result |
|---|---|
| api-gateway 519 pass (522 total; 3 pre-existing fail) | PASS |
| theme-engine 1441/1441 (unchanged) | PASS |
| merchant 1429 pass (1471 total; 27 pre-existing DB-migration fail) | PASS |
| storefront-runtime 795/795 (unchanged) | PASS |
| All typechecks | PASS (0 errors) |
| validate-governance.mjs | EXIT=1 (pre-existing; unchanged) |
| 3 api-gateway pre-existing failures | Unchanged |
| 27 merchant pre-existing failures | Unchanged |
