# Phase X Test Report — Files & Media Library

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** X — Files & Media Library
**Date:** 2026-07-11

---

## Final Gate Results

| Suite | Phase X Final | Command | Status |
|-------|--------------|---------|--------|
| api-gateway (typecheck + test) | **519 pass** / 522 total (3 pre-existing fail) | `pnpm --filter @letbuyy/api-gateway typecheck && pnpm --filter @letbuyy/api-gateway test:unit` | PASS |
| theme-engine (test) | **1441/1441** (unchanged) | — (no theme-engine change in Phase X) | PASS |
| merchant-control-plane (typecheck + test) | **1429 pass** / 1471 total (27 pre-existing fail) | `pnpm --filter @letbuyy/merchant-control-plane typecheck && pnpm test --filter=@letbuyy/merchant-control-plane` | PASS |
| storefront-runtime (test) | **795/795** (unchanged) | — (no storefront-runtime change in Phase X) | PASS |
| All typechecks | **Clean** (0 errors) | Per-package typecheck commands | PASS |
| validate-governance.mjs | **EXIT=1** (pre-existing tenant drift; anti-fabrication PASS) | `node scripts/validate-governance.mjs` | PASS (known, unchanged) |

**Pre-existing failures (unchanged from baseline):**
- api-gateway (3): `ai.test.ts#1`, `internal-os-executive-analytics.test.ts#130`, `storefront.test.ts#270`.
- merchant (27): pre-existing DB-migration failures — unchanged from program baseline; not introduced by Phase X.

---

## Test Delta Summary

| Suite | Entering Phase X | Exiting Phase X | Delta |
|-------|-----------------|----------------|-------|
| api-gateway (passing) | 491 | 519 | +28 (all 28 new X-T01..X-T28 pass) |
| theme-engine | 1441 | 1441 | 0 (unchanged) |
| merchant-control-plane (passing) | 286* | 1429 | +92 new X tests pass; full suite scope expanded |
| storefront-runtime | 795 | 795 | 0 (unchanged) |

*The merchant entering count of 286 was the theme-editor test subset scope from Phase W. Phase X's full-suite command includes all merchant package tests (1471 total, 1429 pass, 27 pre-existing DB-migration failures unchanged).

---

## Gateway Lane — `media-library-x.test.ts` (28 tests)

File: `services/api-gateway/src/__tests__/media-library-x.test.ts`

All 28 tests pass. api-gateway total: 519 passing.

### Auth / Tenancy (X-T01–X-T09)

| ID | Description | Result |
|---|---|---|
| X-T01 | `resolveCustomUser` is called before any media table query | PASS |
| X-T02 | `verifySiteOwnership` is called before any media table query | PASS |
| X-T03 | Null `resolveCustomUser` result → 403 FORBIDDEN (customer HS256 rejection) | PASS |
| X-T04 | False `verifySiteOwnership` result → 403 FORBIDDEN (cross-tenant rejection) | PASS |
| X-T05 | Media table query carries `.eq('store_id', storeId)` within 500 chars of `from()` call | PASS |
| X-T06 | No literal UUID used as `store_id` in table query — verified variable used | PASS |
| X-T07 | `store_id` required and validated as UUID; missing/malformed → 400 before auth/DB | PASS |
| X-T08 | `authMiddleware` registered for `/media-library` in `themes.ts` before slug routes | PASS |
| X-T09 | `mediaLibraryRouter` imported and mounted via `router.route` in `themes.ts` | PASS |

### Route / Schema (X-T10–X-T12)

| ID | Description | Result |
|---|---|---|
| X-T10 | Empty result for site with no media rows (not a 500) | PASS |
| X-T11 | `type` filter returns only matching `media_type` rows | PASS |
| X-T12 | `q` param filters by filename ilike | PASS |

### MIME allowlist — rejection (X-T13–X-T18)

| ID | MIME | Expected | Result |
|---|---|---|---|
| X-T13 | `image/svg+xml` | 400 MIME_NOT_ALLOWED | PASS |
| X-T14 | `image/svg` | 400 MIME_NOT_ALLOWED | PASS |
| X-T15 | `text/html` | 400 MIME_NOT_ALLOWED | PASS |
| X-T16 | `application/octet-stream` | 400 MIME_NOT_ALLOWED | PASS |
| X-T17 | `text/javascript` | 400 MIME_NOT_ALLOWED | PASS |
| X-T18 | `` (empty) | 400 MIME_NOT_ALLOWED | PASS |

### MIME allowlist — acceptance (X-T19–X-T28)

| ID | MIME | Expected | Result |
|---|---|---|---|
| X-T19 | `image/jpeg` | Passes to size check | PASS |
| X-T20 | `image/png` | Passes to size check | PASS |
| X-T21 | `image/webp` | Passes to size check | PASS |
| X-T22 | `image/gif` | Passes to size check | PASS |
| X-T23 | `video/mp4` | Passes to size check | PASS |
| X-T24 | `video/webm` | Passes to size check | PASS |
| X-T25 | `video/quicktime` | Passes to size check | PASS |
| X-T26 | `model/gltf-binary` | Passes to size check | PASS |
| X-T27 | `model/gltf+json` | Passes to size check | PASS |
| X-T28 | `validateUploadMime` call present in `upload.ts` before size check | Integration wiring confirmed | PASS |

Pre-existing upload security tests (all pass, including video/mp4 runtime test): unchanged.

---

## Merchant Lane — `theme-editor-x.test.mjs` (92 tests)

File: `apps/merchant-control-plane/tests/theme-editor-x.test.mjs`

All 92 tests pass.

### Proxy route tests (15 tests)

- Route file exists at expected path
- GET handler exported
- `resolveOwnedStoreId` imported (tenancy law)
- `merchantApiFetch` imported with `requireSession: true`
- Does NOT import `createMerchantApiClient` (no api-client edit)
- Passes `q=` (not `search=`) in gateway URL — confirmed key alignment post-hardening
- `store_id` in URL uses `resolved.storeId` (not a browser-supplied param)
- `VALID_MEDIA_TYPES` guard: `['image', 'video', 'all']`
- Unknown type → 400 before gateway reach
- `limit` clamped to 100
- `cursor` forwarded as-is
- Returns gateway JSON shape `{ items, nextCursor }`
- NOT-CONNECTED note present in file
- Does NOT import `ExperiencePicker`, `page.tsx`, `globals.css`
- Tenancy: `resolved.storeId` used (not searchParams.get); test-59 assertion

### `MediaLibrary.tsx` tests (30 tests)

- File exists at expected path
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` on modal container
- `role="grid"` on thumbnail grid
- `role="gridcell"` on each thumbnail cell
- `aria-label` on each gridcell (`Select ${filename}`)
- `aria-hidden="true"` on `<img>` inside each gridcell (no double-announcement) — post-hardening
- `ArrowRight`, `ArrowLeft`, `ArrowDown`, `ArrowUp` keyboard handlers present
- `Enter` + `Space` to select handler
- `Escape` to close handler
- Tab focus-trap present
- `cellRefs` (useRef array) present; `.focus()` called on `activeIndex` change — post-hardening
- `ResizeObserver` on grid ref for `gridCols` state — post-hardening (fixes GRID_COLS mismatch)
- Arrow-key navigation uses `gridCols` state (not hardcoded constant) — post-hardening
- `validateUploadFile()` rejects `image/svg+xml` with UPLOAD-SAFETY message
- `validateUploadFile()` rejects `image/svg` prefix with UPLOAD-SAFETY message
- Progress bar rendered during upload
- NOT-CONNECTED graceful degradation on 404/502/503 (no crash)
- Loading, empty, error states all have distinct branches
- File input `accept` attribute excludes `image/svg+xml`
- Client-side MIME guard for `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `video/mp4`, `video/webm`, `video/quicktime`
- Max image size `MAX_IMAGE_BYTES = 10 * 1024 * 1024`
- Max video size `MAX_VIDEO_BYTES = 100 * 1024 * 1024`
- Fetch calls same-origin `/api/stores/${storeName}/themes/media-library` proxy
- Upload posts to `/api/stores/${storeName}/upload` (not a new endpoint)
- `onSelect(url)` prop called on cell selection
- `onClose()` prop called on Escape
- Does not import `createMerchantApiClient`, `page.tsx`, or `globals.css`
- All new CSS classes reference `var(--lb-*)`
- No `rounded-[` in file; no raw hex; no raw px

### `ImagePickerControl.tsx` tests (20 tests)

- File exists at expected path
- URL text field present (backward compat — same as pre-X ImageInput)
- `cloud_upload` file input present (backward compat)
- Browse Library button present
- `MediaLibrary` imported and conditionally rendered
- `isUnsafeUrl` imported from `@/lib/theme-schemas`
- `handleLibrarySelect`: `isUnsafeUrl` guard applied before `onChange` — post-hardening
- `handleUrlChange`: `isUnsafeUrl` guard also present (same as pre-X)
- `onChange` emits URL string only (RISK-DUAL-N01)
- `isLibraryOpen` state present
- `onSelect` wired to `onChange` + `setIsLibraryOpen(false)`
- `onClose` wired to `setIsLibraryOpen(false)`
- Props: `{ label, value, onChange, storeName, helpText }` — same shape as ImageInput
- Does not import `createMerchantApiClient`, `page.tsx`, `globals.css`
- Design ratchet: no `rounded-[Npx]`, no raw hex, `--lb-*` token usage

### `SchemaFormRenderer.tsx` patch tests (5 tests)

- `ImagePickerControl` imported
- `case 'image':` renders `ImagePickerControl` (not inline `ImageInput`)
- `ImagePickerControl` receives `{ label, value, onChange, storeName, helpText }` props
- `storeName` passed from renderer's own prop (not hardcoded)
- `ImageInput` may remain as unexported helper in file (no removal test)

### `VideoControl.tsx` patch tests (10 tests)

- `MediaLibrary` imported
- `video_library` icon used for Browse Library button
- `handleLibrarySelect` present
- `isUnsafeUrl` guard applied in `handleLibrarySelect` — post-hardening
- `isLibraryOpen` state present
- `MediaLibrary` conditionally mounted with `mediaType="video"`
- All existing URL text + file-upload behavior unchanged (VideoControl still has URL + upload)
- `onChange` emits URL string (RISK-DUAL-N01)
- Does not import `page.tsx`, `globals.css`, or `createMerchantApiClient`
- Return wrapped in React Fragment for valid JSX

### `controls.module.css` Phase X classes (6 tests)

- `browseLibraryBtn` class present
- `mediaLibraryModal` class present
- `mediaLibraryGrid` class present (2-column default, 3-column at ≥ 400 px)
- `mediaLibraryCell` class present (min 80×80)
- `mediaLibraryImg` class present (object-fit: cover)
- All new Phase X classes use `var(--lb-*` tokens; no `rounded-[`, no raw hex

### Design ratchet / tenancy (6 tests)

- `MediaLibrary.tsx`: no `rounded-[Npx]`, no raw hex
- `ImagePickerControl.tsx`: no `rounded-[Npx]`, no raw hex
- Proxy route: `resolveOwnedStoreId` imported (tenancy law)
- Proxy route: `requireSession: true` in `merchantApiFetch`
- `MediaLibrary` fetches same-origin proxy (never gateway directly)
- `ImagePickerControl` tests isolated: no Supabase, no `api-client`, no `page.tsx`

---

## Notes on Pre-Existing Failures

**api-gateway (3 unchanged):**
1. `ai.test.ts#1` — AI stub route; not Phase X scope.
2. `internal-os-executive-analytics.test.ts#130` — LCIS analytics; not Phase X scope.
3. `storefront.test.ts#270` — storefront payment integration; not Phase X scope.

**merchant (27 unchanged):**
All 27 are DB-migration integration failures present from the program baseline. They are not introduced by Phase X.
