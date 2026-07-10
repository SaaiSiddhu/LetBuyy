# Media Library Reference — Phase X

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** X — Files & Media Library
**Date:** 2026-07-11

This document is the authoritative reference for the Phase X media library system: storage model, MIME policy, API contract, picker component, and integration points.

---

## 1. Storage Architecture

### 1.1 Upload path

```
Browser (file input)
  → POST /api/stores/{storeName}/upload  (merchant-control-plane proxy)
  → resolveOwnedStoreId → merchantApiFetch
  → POST /v1/upload  (api-gateway)
  → verifyUploadStoreOwnership
  → validateUploadMime(file)          ← Phase X: MIME gate
  → per-kind size check
  → R2_BUCKET.put(key, stream)        ← CONNECTED
  → media table INSERT                ← CONNECTED
```

**Storage key format:** `${folder}/${auth.user.id}/${Date.now()}-${fullUUID}.${ext}`

- `folder` is supplied by the merchant proxy: defaults to `<storeId>/products`.
- `auth.user.id` is the authenticated user's id from the ES256 token.
- Full 32-character UUID (122 bits); no truncation since Phase X hardening.
- Key is NOT site-scoped in path structure — cross-store isolation is API-level via `verifySiteOwnership`. See RISK-X01.

**Public CDN URL:** `${ASSET_PUBLIC_BASE_URL}/${key}`. The CDN sits in front of the R2 bucket. The URL stored in the `media` table is the CDN URL.

**Local dev fallback:** when `R2_BUCKET` binding is absent (no Cloudflare local dev binding), `upload.ts` falls back to an inline base64 data URI. This is the expected behavior in pure Node.js dev environments.

### 1.2 Media table

The `media` table (Supabase) is the canonical source of record for uploaded files. Each row:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `store_id` | uuid | Tenant key — ALL queries must carry `.eq('store_id', storeId)` |
| `filename` | text | Stored filename |
| `original_name` | text | Original filename from upload |
| `url` | text | CDN URL |
| `thumbnail_url` | text | Thumbnail CDN URL (nullable; no server-side generation in Phase X) |
| `mime_type` | text | MIME type from upload |
| `size_bytes` | bigint | File size |
| `alt_text` | text | Optional alt text |
| `media_type` | text | `'image'` / `'video'` / `'model'` |
| `created_at` | timestamptz | Upload timestamp |

`media_assets` is an optional secondary mirror. Writes are silently null-safe (`isOptionalMediaAssetWriteError`). Do not depend on `media_assets` being present.

---

## 2. MIME Policy

### 2.1 Allowlist

File: `services/api-gateway/src/lib/upload-mime.ts`

```typescript
export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
  'model/gltf-binary', 'model/gltf+json',
]);
```

### 2.2 SVG policy

**SVG uploads are REJECTED.** `image/svg+xml` and any `image/svg` prefix return `400 { code: 'MIME_NOT_ALLOWED' }`.

**Rationale:** Cloudflare Workers have no DOM parser. Text/regex stripping of SVG scripts, event handlers (`onload`, `onerror`), `<use xlink:href>`, and `<foreignObject>` is known-bypassable and must not be used. All legitimate theme-image use cases (hero images, logos rasterised, product backgrounds) are covered by JPEG/PNG/WebP/GIF.

**Future SVG support:** requires a separate upload pipeline with a server-side Node.js worker running DOMPurify. Not implementable within the CF Worker environment. Any phase adding SVG support must route through a dedicated sanitizer sidecar, not through the existing `/v1/upload` handler.

### 2.3 `validateUploadMime` function

```typescript
function validateUploadMime(file: File): { ok: boolean; error?: string }
```

Called in `upload.ts` after file extraction, **before** the size check. Returns `{ ok: true }` for allowed types; `{ ok: false, error: 'Upload type not allowed: image/svg+xml. Allowed types: ...' }` for rejected types.

---

## 3. Media Library API Contract

### 3.1 Gateway sub-router

File: `services/api-gateway/src/routes/themes/media-library.ts`

Mounted at `GET /v1/themes/media-library` via `router.route('/media-library', mediaLibraryRouter)` in `routes/themes.ts`.

**Authentication:** `authMiddleware` (global, registered in `themes.ts` before all sub-routes) + `resolveCustomUser` (rejects customer HS256 tokens) + `verifySiteOwnership` (tenant gate).

**Request query parameters:**

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `store_id` | uuid | Yes | Verified via `verifySiteOwnership`; 400 if absent or malformed |
| `type` | `'image' \| 'video' \| 'all'` | No | Default: `'all'` |
| `q` | string (max 200 chars) | No | ilike filter on `filename` OR `original_name`; special chars stripped |
| `cursor` | string | No | Opaque pagination cursor |
| `limit` | int (1–100) | No | Default: 20 |

**Response 200:**

```json
{
  "items": [
    {
      "id": "uuid",
      "filename": "hero-banner.jpg",
      "url": "https://cdn.letbuyy.com/site123/user456/1720651234567-abcdef.jpg",
      "thumbnail_url": "https://cdn.letbuyy.com/thumbs/...",
      "mime_type": "image/jpeg",
      "size_bytes": 245600,
      "alt_text": "Summer collection hero",
      "media_type": "image",
      "created_at": "2026-07-11T10:30:00.000Z"
    }
  ],
  "nextCursor": "eyJpZCI6InV1aWQifQ==" | null
}
```

**Error responses:**

| Status | Code | Condition |
|---|---|---|
| 400 | `INVALID_STORE_ID` | `store_id` missing or not a valid UUID |
| 403 | `FORBIDDEN` | Customer HS256 token; or cross-tenant access |
| 500 | `DB_ERROR` | Supabase query failure (e.g. `media` table absent in a fresh environment) |

### 3.2 Merchant proxy

File: `apps/merchant-control-plane/src/app/api/stores/[store]/themes/media-library/route.ts`

```
GET /api/stores/{storeName}/themes/media-library?type=...&q=...&cursor=...&limit=...
```

- Uses `resolveOwnedStoreId` to verify ownership; forwards `resolved.storeId` as `store_id` to the gateway.
- Uses `q=` parameter name (not `search=`) — matches gateway Zod schema key `q`.
- Uses `merchantApiFetch` with `requireSession: true`.
- Validates `type` against `VALID_MEDIA_TYPES = ['image', 'video', 'all']`; unknown type → 400.
- Clamps `limit` to 100.
- Returns gateway JSON as-is.

---

## 4. MediaLibrary Component

File: `apps/merchant-control-plane/src/components/theme-editor/controls/MediaLibrary.tsx`

### 4.1 Props

```typescript
type MediaLibraryProps = {
  storeName: string;
  mediaType: 'image' | 'video' | 'all';
  onSelect: (url: string) => void;
  onClose: () => void;
};
```

### 4.2 States

| State | Trigger |
|---|---|
| Loading | Fetch in flight |
| Items (grid) | Fetch returned ≥ 1 items |
| Empty | Fetch returned 0 items |
| Error | Fetch returned error or NOT-CONNECTED (404/502/503) |
| Upload in progress | File selected from upload affordance |

### 4.3 Keyboard navigation

| Key | Action |
|---|---|
| `ArrowRight` | Move to next cell in same row |
| `ArrowLeft` | Move to previous cell in same row |
| `ArrowDown` | Move to cell in next row (uses `gridCols` from ResizeObserver) |
| `ArrowUp` | Move to cell in previous row (uses `gridCols` from ResizeObserver) |
| `Enter` / `Space` | Select highlighted cell → `onSelect(url)` → modal closes |
| `Escape` | Close modal → `onClose()` |
| `Tab` | Focus-trap: cycles through focusable elements inside modal only |

`cellRefs` array stores `HTMLDivElement` refs for each gridcell. When `activeIndex` changes, `cellRefs.current[activeIndex]?.focus()` is called (via `useEffect`). This ensures DOM focus tracks the highlighted cell for screen readers.

### 4.4 Grid layout

- Mobile (< 400 px): 2 columns.
- Desktop (≥ 400 px): 3 columns (CSS media query in `controls.module.css`).
- Minimum cell size: 80×80 px.
- `ResizeObserver` on the grid element reads `getComputedStyle(el).gridTemplateColumns` to count actual rendered column tracks → stored in `gridCols` state (2 or 3).

### 4.5 Upload affordance

A file input inside `MediaLibrary` accepts: `image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime` (no SVG). On file selection:
1. `validateUploadFile(file)` checks MIME client-side.
2. If valid: POST to `/api/stores/{storeName}/upload` (existing proxy — registers the record in `media` table automatically).
3. Progress bar shown during upload.
4. On success: grid refreshes to include the new file.

### 4.6 ARIA structure

```html
<div role="dialog" aria-modal="true" aria-labelledby="media-library-title">
  <h2 id="media-library-title">Media Library</h2>
  <div role="grid">
    <div role="gridcell" aria-label="Select hero-banner.jpg" tabIndex={…}>
      <img src="…" alt="" aria-hidden="true" />   <!-- hidden: cell label covers it -->
      <input type="text" aria-label="Alt text" />  <!-- on hover -->
    </div>
    …
  </div>
  <!-- Upload section, Search input, Pagination -->
</div>
```

The `<img>` inside each cell has `aria-hidden="true"` to prevent double-announcement: the cell's `aria-label` already provides the accessible name; the image itself is decorative within the cell context.

---

## 5. ImagePickerControl

File: `apps/merchant-control-plane/src/components/theme-editor/controls/ImagePickerControl.tsx`

Drop-in replacement for the Phase M frozen `ImageInput`. Props:

```typescript
type ImagePickerControlProps = {
  label?: string;
  value: string | null;
  onChange: (url: string) => void;
  storeName?: string;
  helpText?: string;
};
```

### 5.1 Branches

| `storeName` | Behavior |
|---|---|
| Provided | URL text input + `cloud_upload` file upload + **Browse Library** button (opens `MediaLibrary`) |
| Absent | URL text input + `cloud_upload` file upload only (identical to pre-X `ImageInput`) |

Browse Library button only renders when `storeName` is provided. The `MediaLibrary` modal is conditionally mounted via `isLibraryOpen` state.

### 5.2 Safety guards

- `handleUrlChange(url)`: `isUnsafeUrl(url)` checked before `onChange(url)` (pre-X behavior, unchanged).
- `handleLibrarySelect(url)`: `isUnsafeUrl(url)` checked before `onChange(url)` (Phase X hardening).

### 5.3 RISK-DUAL-N01

`onChange` emits a URL string only. No `DynamicSourceDescriptor` is constructed or emitted by this component. From `applyChange()`'s perspective, a library-selected URL is identical to a manually-typed URL.

---

## 6. VideoControl — Browse Library Button

File: `apps/merchant-control-plane/src/components/theme-editor/controls/VideoControl.tsx`

Phase X adds:
- `isLibraryOpen` state.
- `handleLibrarySelect(url)`: `isUnsafeUrl(url)` guard → `onChange(url)`.
- "Browse Library" button with `video_library` MaterialIcon.
- `<MediaLibrary mediaType="video" storeName={storeName} onSelect={handleLibrarySelect} onClose={…} />` conditionally mounted.

All existing URL text and file-upload behavior is unchanged. The return is wrapped in a React Fragment to accommodate the new conditional `MediaLibrary` mount.

---

## 7. SchemaFormRenderer Integration

File: `apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx`

The `case 'image':` branch now renders `<ImagePickerControl>` instead of inline `ImageInput`. Props passed are identical: `{ label, value, onChange, storeName, helpText }`. This is a 4-line change. `ImageInput` may remain as an unexported helper in `SchemaFormRenderer.tsx` if used by other cases, or it may be moved into `ImagePickerControl.tsx`.

---

## 8. NOT-CONNECTED Inventory

| Component | NOT-CONNECTED piece | Impact |
|---|---|---|
| `MediaLibrary.tsx` | If gateway `media-library` route not deployed (Lane A absent) | 404 → error state; editor still functional for URL entry and direct upload |
| `media_assets` mirror | `media_assets` table absent → writes silently swallowed | No functional impact; `media` table is the canonical record |
| `thumbnail_url` | No server-side thumbnail generation | `MediaLibrary.tsx` falls back to `url`; full-size image used as thumbnail |

---

## 9. Testing

Unit tests covering this system:

| File | Tests | Scope |
|---|---|---|
| `services/api-gateway/src/__tests__/media-library-x.test.ts` | 28 (X-T01..X-T28) | Tenancy, auth, MIME allowlist |
| `apps/merchant-control-plane/tests/theme-editor-x.test.mjs` | 92 | Proxy, MediaLibrary, ImagePickerControl, VideoControl, SchemaFormRenderer, controls.module.css |

See `PHASE_X_TEST_REPORT.md` for full test breakdown.
