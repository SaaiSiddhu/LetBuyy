# Phase X Discovery — Files & Media Library

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** X — Files & Media Library
**Date:** 2026-07-11
**Scope:** Pre-phase inventory of the upload pipeline, media table state, `image` and `video` field type state entering Phase X, SVG attack surface, and storage reality.

---

## 1. Pre-Phase-X State of `image` Field Type

`SchemaFormRenderer.tsx` (case `'image'`) rendered an inline `ImageInput` helper component:
- A URL text field accepting an arbitrary HTTPS string.
- A `cloud_upload` file input posting to `/api/stores/${storeName}/upload`.
- No media library browse affordance; merchants had to type or upload a URL directly — no way to select a previously uploaded file.

`VideoControl.tsx` (introduced Phase U) had the same gap: URL text + file upload, no library browse.

Both controls called `isUnsafeUrl` on manual URL entry but had no equivalent guard for a library-selected URL (there was no library).

---

## 2. Pre-Phase-X Upload Pipeline

### 2.1 Merchant proxy

`apps/merchant-control-plane/src/app/api/stores/[store]/upload/route.ts` existed and was clean:
- Calls `resolveOwnedStoreId` to verify store ownership.
- Appends `folder=<storeId>/products` and `store_id=<storeId>` to FormData.
- Calls `apiClient.upload.file()` then `apiClient.media.create()`.

### 2.2 Gateway upload handler

`services/api-gateway/src/routes/upload.ts` (`POST /v1/upload`) existed with:
- `verifyUploadStoreOwnership` (resolveCustomUser + verifySiteOwnership).
- Per-kind size limits: 10 MB (images), 100 MB (video), 50 MB (3D models).
- `c.env.R2_BUCKET.put(key, file.stream(), {...})` — storage fully CONNECTED.
- Storage key: `${folder}/${auth.user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}` — user-scoped, NOT site-scoped in key path.
- **Gap (entering X):** No MIME type allowlist. SVG (`image/svg+xml`), HTML (`text/html`), and executables could pass through unchecked. The upload handler relied entirely on file extension in the key — an attacker could upload an SVG with `Content-Type: image/png` and a `.svg` extension.

### 2.3 Media table

`services/api-gateway/src/routes/media.ts` (`GET /v1/media`) existed:
- Queries `media` table with `.eq('store_id', storeId)`.
- Gated by `verifySiteOwnership`.
- Returned full media rows for a store.
- No unified theme-scoped media-library sub-router existed. The route was for general media listing, not a picker-ready API.

`media_assets` secondary mirror table: attempted on every upload via an optional write, swallowed silently if table is absent (`isOptionalMediaAssetWriteError`).

### 2.4 Merchant media proxy

`apps/merchant-control-plane/src/app/api/stores/[store]/media/route.ts` existed for general media listing but was not a theme-editor picker.

---

## 3. SVG Attack Surface (Pre-Phase-X)

No server-side SVG rejection existed. Two mitigations were present entering Phase X:
1. `isUnsafeUrl` in `schema-field-extensions.ts` rejected `data:image/svg` data URIs in URL fields (but not uploads).
2. The upload key used the file extension — `.svg` extensions would be stored but the CDN URL would be served as `image/svg+xml` content type, triggering browser script execution on inline SVG.

Cloudflare Workers have no DOM parser. Text/regex stripping of SVG scripts, event handlers, `<use xlink:href>`, and `<foreignObject>` is known-bypassable. A server-side SVG sanitizer would need DOMPurify running in a Node.js worker — not achievable within the CF Worker itself.

**Conclusion entering X:** SVG uploads must be rejected outright at the MIME type level.

---

## 4. Pre-Phase-X Media Library Gap

No media library component existed for the theme editor. Entering Phase X:
- `image` field: URL text + file upload (inline ImageInput). No history / browse.
- `video` field: VideoControl — URL text + file upload. No history / browse.
- No gallery-style picker existed anywhere in the merchant editor.
- No `GET /v1/themes/media-library` route existed (distinct from the general `GET /v1/media` route).

**Shopify parity:** Shopify's Files section provides a full media library accessible from every image picker and file picker in the theme editor. Picking a previously-uploaded file is the primary workflow, not re-uploading.

---

## 5. Foreign WIP Constraints Entering Phase X

Files carrying prior user modifications that Phase X must not write to:
- `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`
- `services/api-gateway/src/index.ts`
- `packages/api-client/src/index.ts` (listed as `packages/typescript/api-client/src/index.ts` in the gateway package tree)
- `apps/merchant-control-plane/src/app/globals.css`
- `apps/merchant-control-plane/src/components/theme-editor/ExperiencePicker.tsx`

These constraints were identical to Phase W. All Phase X new routes and components must avoid these files entirely — mounting in `themes.ts`, using raw `merchantApiFetch`, scoping new CSS to `controls.module.css`, and making `SchemaFormRenderer.tsx` the wiring point (not `page.tsx`).
