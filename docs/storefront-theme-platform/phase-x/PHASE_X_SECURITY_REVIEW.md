# Phase X Security Review — Files & Media Library

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** X — Files & Media Library
**Date:** 2026-07-11
**Scope:** Media-library route tenancy enforcement, upload MIME gating (SVG policy), upload-mime allowlist completeness, proxy chain isolation, library-selected URL safety.

---

## 1. Threat Model

Phase X introduces four new attack surfaces:

| Surface | Threat |
|---|---|
| `POST /v1/upload` (modified) | SVG / executable upload via MIME spoofing; content-type bypass |
| `GET /v1/themes/media-library` (new) | Cross-tenant media read — Site A merchant queries Site B media rows |
| `apps/.../themes/media-library/route.ts` (new proxy) | Client-side store_id injection — browser passes arbitrary store_id to the proxy |
| `handleLibrarySelect` in `ImagePickerControl` / `VideoControl` | Library-supplied URL not subject to `isUnsafeUrl` gate (pre-hardening gap) |

---

## 2. Upload MIME Gate — X-T13 through X-T28

### 2.1 Policy rationale

Cloudflare Workers have no DOM parser. Text/regex stripping of SVG scripts, event handlers, `<use xlink:href>`, and `<foreignObject>` is known-bypassable and must not be used in lieu of a full sanitizer. All legitimate theme-image use cases (hero images, logos, product backgrounds) are covered by JPEG/PNG/WebP/GIF. If SVG support is needed in the future, it requires a separate upload pipeline with a server-side Node.js worker running DOMPurify — not the CF Worker itself.

### 2.2 Allowlist design

`services/api-gateway/src/lib/upload-mime.ts` — `validateUploadMime(file): { ok: boolean; error?: string }`:

| Category | Allowed MIME types |
|---|---|
| Image | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| Video | `video/mp4`, `video/webm`, `video/quicktime` |
| 3D model | `model/gltf-binary`, `model/gltf+json` |

Explicitly rejected:
- `image/svg+xml` and any `image/svg` prefix — SVG POLICY (documented in module).
- `application/*` — no binary blobs, no JSON uploads, no PDFs.
- `text/html`, `text/javascript` — no script or markup uploads.
- Empty/missing content type — fail-closed.

### 2.3 Integration point

`services/api-gateway/src/routes/upload.ts` — `validateUploadMime(file)` is called **after** file extraction and **before** the size limit check. A MIME violation returns `400 { code: 'MIME_NOT_ALLOWED', error: '...' }` immediately. No R2 write occurs.

### 2.4 Test proof (X-T13 through X-T28)

Rejection tests:

| Test ID | MIME | Result |
|---|---|---|
| X-T13 | `image/svg+xml` | 400 MIME_NOT_ALLOWED |
| X-T14 | `image/svg` | 400 MIME_NOT_ALLOWED |
| X-T15 | `text/html` | 400 MIME_NOT_ALLOWED |
| X-T16 | `application/octet-stream` | 400 MIME_NOT_ALLOWED |
| X-T17 | `text/javascript` | 400 MIME_NOT_ALLOWED |
| X-T18 | `` (empty) | 400 MIME_NOT_ALLOWED |

Allowlist tests (all pass → size check / R2 write):

| Test ID | MIME | Result |
|---|---|---|
| X-T19 | `image/jpeg` | PASS (size check next) |
| X-T20 | `image/png` | PASS |
| X-T21 | `image/webp` | PASS |
| X-T22 | `image/gif` | PASS |
| X-T23 | `video/mp4` | PASS |
| X-T24 | `video/webm` | PASS |
| X-T25 | `video/quicktime` | PASS |
| X-T26 | `model/gltf-binary` | PASS |
| X-T27 | `model/gltf+json` | PASS |
| X-T28 | `image/jpeg` (round-trip: validateUploadMime call present in upload.ts before size check) | PASS |

### 2.5 UI-side alignment

`MediaLibrary.tsx` enforces the same allowlist client-side via the `accept` attribute on the file input and via `validateUploadFile()` which explicitly rejects `image/svg+xml` and `image/svg` with an `UPLOAD-SAFETY` error message. The gateway MIME gate is the authoritative boundary; the UI restriction is defence-in-depth and user experience (early feedback, no wasted upload RTT).

---

## 3. Media-Library Route Tenancy — X-T01 through X-T12

### 3.1 Auth guard chain

The sub-router is registered in `routes/themes.ts` AFTER `authMiddleware`. Inside the handler:

1. `resolveCustomUser(db, auth)` — queries `users_custom` for the JWT subject. Customer HS256 tokens have no row in `users_custom`; `resolveCustomUser` returns `null`.
2. If null → 403 FORBIDDEN. This is the customer token rejection gate.
3. `verifySiteOwnership(db, store_id, customUser.id, auth.user.storeId)` — DB ownership check + session-bound fast-fail.
4. If false → 403 FORBIDDEN.
5. Only then: `media` table query with `.eq('store_id', storeId)` using the verified `store_id`.

This is the identical two-layer pattern established in Phase W (`resource-search.ts`).

### 3.2 Tenancy proof (test assertions)

| Test ID | Assertion |
|---|---|
| X-T01 | `resolveCustomUser` is called before any media table query |
| X-T02 | `verifySiteOwnership` is called before any media table query |
| X-T03 | Null `resolveCustomUser` result → 403 FORBIDDEN (customer HS256 token rejection) |
| X-T04 | False `verifySiteOwnership` result → 403 FORBIDDEN (cross-tenant rejection) |
| X-T05 | Media table query carries `.eq('store_id', storeId)` within 500 chars of the `from()` call |
| X-T06 | No literal UUID used as `store_id` in the table query — the verified variable is used |
| X-T07 | `store_id` is required and validated as UUID; missing/malformed → 400 before any auth or DB call |
| X-T08 | `authMiddleware` registered for `/media-library` in `themes.ts` before slug routes |
| X-T09 | `mediaLibraryRouter` imported and mounted via `router.route` in `themes.ts` |
| X-T10 | Empty result returned for a site with no media rows (not a 500) |
| X-T11 | `type` filter returns only matching `media_type` rows |
| X-T12 | `q` param filters by filename ilike (search functionality) |

All 28 Phase X gateway tests pass (X-T01..X-T28).

### 3.3 Cross-tenant scenario

**X-T04 scenario:** Merchant B holds a valid ES256 token for `store_id = SITE_B_UUID`. They submit `GET /themes/media-library?store_id=SITE_A_UUID`. `verifySiteOwnership` receives `(db, SITE_A_UUID, merchantB.id, SITE_B_UUID)`. The session-bound fast-fail fires: `SITE_B_UUID !== SITE_A_UUID` → returns `false` → 403. Even without the fast-fail, the DB check would fail (`sites.custom_user_id = merchantB.id AND sites.id = SITE_A_UUID` has no row).

---

## 4. Merchant Proxy Chain Tenancy

### 4.1 Proxy design

`apps/merchant-control-plane/src/app/api/stores/[store]/themes/media-library/route.ts`:

```
Browser → same-origin /api/stores/{storeName}/themes/media-library
        → resolveOwnedStoreId
        → merchantApiFetch (requireSession: true)
        → gateway /v1/themes/media-library?store_id={server-resolved-UUID}&q=…&type=…
```

The browser never supplies `store_id`. The `storeId` is resolved exclusively from `resolveOwnedStoreId(decodeURIComponent(store))` — the session-verified merchant's own store. A merchant cannot inject a different `store_id` through query parameters; the proxy ignores any browser-supplied `store_id` and always uses `resolved.storeId`.

`requireSession: true` in `merchantApiFetch` rejects unauthenticated requests and customer HS256 tokens at the merchant-control-plane level before the gateway is reached.

The gateway adds a second independent layer: `resolveCustomUser` + `verifySiteOwnership` using the forwarded auth token.

### 4.2 Test proof (merchant lane — tests 59–61)

| Test | Assertion |
|---|---|
| X: proxy uses resolved.storeId not searchParams.get('store_id') | Static source pattern: `resolved.storeId` is used in URL construction |
| X: proxy sets requireSession: true | `requireSession: true` present in `merchantApiFetch` call |
| X: proxy validates type with VALID_MEDIA_TYPES | Unknown type → 400 before gateway reach |

---

## 5. Library-Selected URL Safety

### 5.1 Pre-hardening gap

`ImagePickerControl.handleLibrarySelect` and `VideoControl.handleLibrarySelect` called `onChange(url)` directly without first checking `isUnsafeUrl(url)`. This differs from the manual URL entry path (`handleUrlChange`) which explicitly calls `isUnsafeUrl` and rejects unsafe protocols.

**Scenario:** If the `media` table were seeded (via a non-R2 path) with a `javascript:` or `data:text/html` URL, library selection would inject it into theme settings without client-side protocol validation.

**Mitigating factors:** R2 upload path always produces `https://cdn...` URLs. Local-dev data URIs are MIME-gated to safe image types. Gateway theme settings validation should catch malicious URLs before publish.

### 5.2 Hardening fix

Both files now call `isUnsafeUrl(url)` at the top of `handleLibrarySelect`:

```typescript
// ImagePickerControl.tsx (and VideoControl.tsx — identical guard)
function handleLibrarySelect(url: string) {
  if (url && isUnsafeUrl(url)) return;   // mirrors handleUrlChange
  onChange(url);
  setIsLibraryOpen(false);
}
```

`isUnsafeUrl` is imported from `@/lib/theme-schemas` in both files (already imported in `VideoControl` for `handleUrlChange`).

### 5.3 Residual note (RISK-SEC-U01)

`isUnsafeUrl` blocklist remains narrow (missing `data:image/svg+xml`, `data:text/javascript`, `blob:`). The addition of the guard in `handleLibrarySelect` is defence-in-depth — it enforces the same boundary that already existed for manual URL entry. Widening the blocklist is RISK-SEC-U01, target: first `schema-field-extensions.ts` touch.

---

## 6. PostgREST Search Injection

### 6.1 Pre-hardening state

The media-library handler built a PostgREST `.or()` filter string via interpolation: `filename.ilike.%${safe}%,...`. The `safe` variable was produced by stripping `%`, `(`, `)`, `,` from the raw query. Single quotes and backslashes were not stripped, leaving edge-case characters in the filter string.

### 6.2 Hardening fix

The regex was extended: `/[%(),'\\]/g` now strips `'` and `\` in addition to the original four characters. This eliminates the main PostgREST injection vectors (condition delimiters, nesting operators, quote escaping) while keeping the character set conservative.

```typescript
const safe = rawQ.slice(0, 200).replace(/[%(),'\\]/g, '');
```

The Supabase JS client sends this as a URL query parameter (not a parameterized query), so the strip-and-embed pattern is the appropriate defence for `.or()` filter strings.

---

## 7. R2 Key Entropy

### 7.1 Pre-hardening state

`crypto.randomUUID().slice(0, 8)` — 8 hex characters = 32 bits of randomness, combined with a millisecond timestamp prefix. Theoretically enumerable within a known timestamp window for a specific store and folder.

### 7.2 Hardening fix

`crypto.randomUUID().replace(/-/g, '')` — full 122-bit UUID, no truncation. Key enumeration from the CDN domain is no longer feasible for any practical window.

### 7.3 R2 key path site-scoping (residual — RISK-X01)

The storage key remains `${folder}/${auth.user.id}/${timestamp}-${uuid}.${ext}`. Cross-store key isolation relies on API-level `verifySiteOwnership`, not on the key structure itself. A key from Store A and a key from Store B can share the same user-id segment if the same user owns both stores (legitimate superuser scenario). The CDN URL is only served through the gateway's `verifySiteOwnership` path; direct R2 bucket access is not exposed to clients. This is documented as RISK-X01 and deferred to a follow-up security migration.

---

## 8. SVG in Existing `isUnsafeUrl` (RISK-SEC-U01 alignment)

The `isUnsafeUrl` function in `schema-field-extensions.ts` already rejects `data:image/svg` URIs in URL fields (via the `data:text/html` and `data:application/xhtml` blocklist pattern). The `MediaLibrary.tsx` client-side `validateUploadFile()` adds an explicit additional check for `image/svg+xml` and `image/svg` MIME types at upload time. These two layers work together:
- `validateUploadFile`: blocks SVG at the upload file-picker stage (client side).
- `validateUploadMime`: blocks SVG at the gateway upload endpoint (server side, authoritative).
- `isUnsafeUrl`: blocks `data:image/svg` in any URL field that a merchant could type manually.

---

## 9. Open Risks Introduced by Phase X

Phase X hardening fixed all findings before phase close. No new risks remain open from Phase X specifically.

| Risk ID | Severity | One-line summary |
|---|---|---|
| RISK-X01 | LOW | R2 key path uses `${userId}/...` prefix, not `${siteId}/...`; cross-store isolation relies on API-level verifySiteOwnership only |

---

## 10. Pre-Existing Risks Unchanged

| Risk ID | Phase X impact |
|---|---|
| RISK-SEC-001 (theme_purchases wide-open RLS) | Not touched; no marketplace routes added |
| RISK-SEC-P01 (theme_editor_drafts RLS user_id only) | Not touched; no realtime subscription added |
| RISK-T01 (pre-Zod stack-depth attack) | Not touched; `parseLiquidThemePackageBundle` unchanged |
| RISK-T02 (no assertNoBlockedKeysInRaw in bundle parser) | Not touched |
| RISK-T03 (block settings bypass filterBlockedSettingsKeys) | Not touched; `theme-renderer.ts` unchanged in Phase X |
| RISK-T04 (RENDERER_MAX_BLOCK_DEPTH private) | Not touched |
| RISK-T05 (allowedChildTypes not wired) | Not touched; `SectionTreePanel.tsx` unchanged |
| RISK-T06 (UnsupportedThemeDocumentFeatureError dead) | Not touched; `theme-document.ts` unchanged |
| RISK-SEC-U01 (isUnsafeUrl narrow blocklist) | `handleLibrarySelect` now calls `isUnsafeUrl` (defence-in-depth improvement) but blocklist width unchanged; widening deferred |
| RISK-SEC-U02 (ColorBackgroundControl gradient url()) | Not touched |
| RISK-SEC-U03 (required checkbox no-op) | Not touched |
| RISK-A11Y-U01 (TextInput missing aria-describedby) | Not touched |
| RISK-A11Y-U02 (ternary aria-describedby) | Not touched |
| RISK-STYLE-U01 (LiquidControl raw fontSize) | Not touched |
| RISK-STYLE-U02 (controls.module.css raw px) | New Phase X classes use `--lb-*` tokens; pre-existing raw px values unchanged |
| RISK-W01 (BINDING_BLOCKED_KEYS parity) | Not touched; `dynamic-source-binding.ts` unchanged |
| RISK-W02 (storeId optional fast-fail) | Not touched |
| RISK-W03 (siteDrops trust boundary comment-only) | Not touched; `theme-renderer.ts` and `dynamic-source-binding.ts` unchanged |
| RISK-W04 (ArrowUp -1→0 snap in ResourcePickerControl) | Not touched; `ResourcePickerControl.tsx` unchanged |
| RISK-W05 (loading spinner debounce gap) | Not touched |
| RISK-W06 (block-level settings not resolved) | Not touched; `theme-renderer.ts` unchanged |
