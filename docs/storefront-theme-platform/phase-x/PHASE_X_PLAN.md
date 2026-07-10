# Phase X Plan — Files & Media Library

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** X — Files & Media Library
**Date:** 2026-07-11

---

## Objective

Deliver (1) a server-side MIME allowlist gating the shared upload endpoint to block SVG and executables, (2) a tenant-safe media-library gateway sub-router for theme-editor picker queries, (3) a `MediaLibrary` modal grid picker with keyboard accessibility and upload affordance, (4) an `ImagePickerControl` wrapping the existing `image` field behavior with a "Browse Library" button, and (5) a Browse Library button wired into `VideoControl` for `video` fields.

---

## Constraints

1. **SVG REJECTED.** `image/svg+xml` and any `image/svg` MIME prefix must be rejected at the gateway upload handler (`upload.ts`) with a `MIME_NOT_ALLOWED` 400. No text/regex SVG stripping. No `DOMPurify` in the CF Worker. Legitimate image use cases (hero images, logos, product backgrounds) are all covered by JPEG/PNG/WebP/GIF.
2. **RISK-DUAL-N01 preserved.** `ImagePickerControl.onChange` and `VideoControl.onChange` emit only the CDN URL string — never a descriptor object. Library selection sets a URL value identical to what a direct URL text entry would produce.
3. **Cross-tenant isolation.** The media-library sub-router must call `resolveCustomUser` + `verifySiteOwnership` before any table query. All `media` table queries carry `.eq('store_id', storeId)` using the server-verified storeId.
4. **Customer HS256 rejection.** `resolveCustomUser` on the gateway sub-router: null result → 403 FORBIDDEN.
5. **Foreign WIP untouched.** `services/api-gateway/src/index.ts`, `packages/api-client/src/index.ts`, `apps/merchant-control-plane/src/app/globals.css`, `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`, and `apps/merchant-control-plane/src/components/theme-editor/ExperiencePicker.tsx` must not be modified.
6. **No api-client import.** The merchant proxy uses raw `merchantApiFetch` (identical to Phase W pattern).
7. **`--lb-*` tokens only** in all new CSS. No `rounded-[Npx]`. No raw hex. No raw `px` spacing.
8. **Mobile-first.** Media grid: 2-column default, 3-column at ≥ 400 px. Minimum cell: 80×80.
9. **`controls.module.css` scoping.** All new Phase X CSS lives in `controls.module.css` — no `globals.css` writes.
10. **`SchemaFormRenderer.tsx` minimal patch.** The `image` case (4 lines) is the only change: import `ImagePickerControl` + render it instead of the inline `ImageInput`. `ImageInput` stays in file as an unexported helper.

---

## Two-Lane Delivery

### Lane A — Gateway

**New file:** `services/api-gateway/src/lib/upload-mime.ts`
- Exports `ALLOWED_UPLOAD_MIME_TYPES` set and `validateUploadMime(file): { ok, error }`.
- Allowlist: `image/jpeg`, `image/png`, `image/webp`, `image/gif` / `video/mp4`, `video/webm`, `video/quicktime` / `model/gltf-binary`, `model/gltf+json`.
- Explicit reject: `image/svg+xml`, `image/svg` prefix, `application/*`, `text/html`, empty/missing type.
- Module comment documents SVG policy and the CF Worker DOMPurify limitation.

**New file:** `services/api-gateway/src/routes/themes/media-library.ts`
- Hono sub-router. Mounted in `routes/themes.ts` at `/media-library` (pattern identical to Phase W `resource-search.ts`).
- `GET /` → `GET /v1/themes/media-library?store_id=uuid&type=image|video|all&q=string&cursor=string&limit=int`.
- Auth: `resolveCustomUser` + `verifySiteOwnership`.
- Queries `media` table: `.eq('store_id', storeId)` + optional type filter + optional ilike on `filename` OR `original_name` + cursor pagination.
- Response: `{ items: [{id, filename, url, thumbnail_url, mime_type, size_bytes, alt_text, media_type, created_at}], nextCursor }`.
- PostgREST search string: strip `%`, `(`, `)`, `,`, `'`, `\` from raw query before embedding in `.or()` filter.

**New file:** `services/api-gateway/src/__tests__/media-library-x.test.ts`
- 28 tests (X-T01..X-T28): cross-tenant isolation, auth guards, type filter, search, MIME allowlist (all allowed types + all rejected types).

**Modified file:** `services/api-gateway/src/routes/upload.ts`
- Import `validateUploadMime` from `../lib/upload-mime`.
- After file extraction and before size check: call `validateUploadMime(file)`; if `!ok` → return 400 `MIME_NOT_ALLOWED`.
- Change `crypto.randomUUID().slice(0, 8)` to `crypto.randomUUID().replace(/-/g, '')` (full 122-bit entropy).
- Approximately 7 lines changed total.

**Modified file:** `services/api-gateway/src/routes/themes.ts`
- Import `mediaLibraryRouter` from `./themes/media-library`.
- Register `router.use('/media-library', authMiddleware)` and `router.route('/media-library', mediaLibraryRouter)` before the Phase W `/resource-search` block and before all `/:slug/*` catch-alls.

### Lane B — Merchant UI

**New file:** `apps/merchant-control-plane/src/app/api/stores/[store]/themes/media-library/route.ts`
- Raw-fetch proxy (no api-client import). `resolveOwnedStoreId` → gateway `GET /v1/themes/media-library?store_id={resolved}&{q|type|cursor|limit}`.
- `VALID_MEDIA_TYPES = ['image', 'video', 'all']` guard; unknown type → 400.
- `limit` clamped to 100. `q` forwarded as `q=` (matching gateway schema key).
- Returns gateway JSON as-is. Documents `NOT-CONNECTED` dependency on Lane A.

**New file:** `apps/merchant-control-plane/src/components/theme-editor/controls/MediaLibrary.tsx`
- Modal dialog (`role="dialog"`, `aria-modal`, `aria-labelledby`).
- Thumbnail grid (`role="grid"`, `role="gridcell"`). 2-column default; 3-column at ≥ 400 px (CSS breakpoint). `ResizeObserver` on the grid element drives `gridCols` state for keyboard navigation arithmetic.
- Arrow-key navigation (ArrowRight/Left/Down/Up using `gridCols` state), Enter/Space to select, Escape to close. Focus-trap for Tab. `cellRefs` array → `.focus()` called on `activeIndex` change.
- Client-side MIME guard: `ALLOWED_UPLOAD_MIME_TYPES` for file input `accept` attribute; explicit SVG rejection in `validateUploadFile()`.
- Upload affordance: file input posts to existing `/api/stores/{store}/upload` proxy (no duplicate media.create call; the proxy already registers the record).
- NOT-CONNECTED graceful degradation: 404/502/503 from gateway → empty/error state (does not crash the editor).
- Props: `storeName: string`, `mediaType: 'image' | 'video' | 'all'`, `onSelect(url: string)`, `onClose()`.

**New file:** `apps/merchant-control-plane/src/components/theme-editor/controls/ImagePickerControl.tsx`
- Wraps the existing `ImageInput` behavior byte-identically (URL text input + `cloud_upload` file input) with an added "Browse Library" button.
- Browse Library button opens `MediaLibrary` in a modal. `onSelect` sets the URL value via `onChange`.
- `isUnsafeUrl` guard applied to library-selected URLs (mirrors `handleUrlChange` guard).
- Backward compat: plain URL text entry works identically to pre-Phase-X `ImageInput`.
- RISK-DUAL-N01: `onChange` emits URL string only.

**Modified file:** `apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx`
- 4-line patch: import `ImagePickerControl`; change `case 'image':` to render `<ImagePickerControl>` instead of inline `ImageInput`. Same props: `{ label, value, onChange, storeName, helpText }`.

**Modified file:** `apps/merchant-control-plane/src/components/theme-editor/controls/VideoControl.tsx`
- Additive patch: import `MediaLibrary`; add `isLibraryOpen` state and `handleLibrarySelect` callback with `isUnsafeUrl` guard; add "Browse Library" button (video_library icon); conditional `<MediaLibrary mediaType="video" ...>` mount. All existing URL + upload behavior unchanged.

**Modified file:** `apps/merchant-control-plane/src/components/theme-editor/controls/controls.module.css`
- New Phase X classes: `browseLibraryBtn`, `mediaLibraryModal`, `mediaLibraryGrid`, `mediaLibraryCell`, `mediaLibraryImg`, `mediaLibraryAltInput`, `mediaLibraryEmpty`, `mediaLibraryError`, `mediaLibraryUpload`, `mediaLibraryProgress`. All using `--lb-*` tokens. Mobile-first 2-column grid.

**New file:** `apps/merchant-control-plane/tests/theme-editor-x.test.mjs`
- 92 static-contract tests covering both new files, modified files, MIME safety, ARIA, keyboard nav, tenancy chain, design ratchet, RISK-DUAL-N01.

**Modified file:** `apps/merchant-control-plane/package.json`
- Minimal: `theme-editor-x.test.mjs` appended to test script. Same pattern as Phases V/W. This file carries prior user modifications; hunk is additive and non-conflicting.

---

## Hardening Pass

After both lanes are implemented and tests pass, a hardening pass fixes any review findings before phase close. All findings (HIGH, MEDIUM, LOW) must be resolved before the phase is marked COMPLETE.
