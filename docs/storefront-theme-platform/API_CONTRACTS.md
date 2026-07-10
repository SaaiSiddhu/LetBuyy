# Theme Platform API Contracts

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Last updated:** 2026-07-10 (post Phase Q)
**Branch:** `stepup/main`

This document records the API contracts for the theme persistence surface: request/response shapes, auth requirements, error codes, and known limitations. Update when a new phase adds or modifies routes.

All routes are on the `services/api-gateway` Hono app at `/v1/themes/*` (after the `/v1` prefix mount). Schema source: `services/api-gateway/src/schemas/theme.schema.ts`.

---

## 1. Auth Requirements (All Routes)

All theme routes require a valid ES256 merchant session token in the `Authorization: Bearer <token>` header. The gateway enforces this via `authMiddleware` at the route prefix level.

| Token type | Result |
|---|---|
| Valid ES256 merchant token | 200 / route proceeds |
| Customer HS256 token | 401 UNAUTHORIZED (rejected at `authMiddleware`) |
| Expired token | 401 UNAUTHORIZED |
| Token with wrong `realm` / `aud` / `token_use` | 401 UNAUTHORIZED |
| Valid Supabase token but no `users_custom` profile | 403 FORBIDDEN (secondary defense) |

---

## 2. POST /themes/:slug/validate

**Status:** NEW (added Phase P)
**Purpose:** Pre-flight validation of a `ThemeDocument` V2 + optional G4 bundle. No DB writes. Use before `publish` to surface schema errors early.

### Request

```typescript
// ValidateThemeDocumentSchema
{
  store_id: string;          // uuid — must be a site owned by the authenticated merchant
  theme_document: Record<string, unknown>;  // ThemeDocument V2 shape (see theme-document.ts)
  bundle?: Record<string, unknown>;         // Optional LiquidThemePackageBundle (G4 gate)
}
```

### Response (200 OK)

```typescript
{
  valid: true;
  schema_version: string;    // e.g. "2.0.0"
  issues: [];                // empty array — all issues surface as 400 errors
}
```

### Error Responses

| Code | Condition |
|---|---|
| 400 Bad Request | `theme_document` fails `parseThemeDocument` validation; or `bundle` present and fails `parseLiquidThemePackageBundle` G4 gate |
| 401 Unauthorized | Missing or invalid merchant token |
| 403 Forbidden | `store_id` not owned by authenticated merchant |
| 422 Unprocessable Entity | Request body does not match `ValidateThemeDocumentSchema` |

### Notes

- No DB read beyond the ownership check.
- A best-effort non-blocking audit event (`theme.document.validate`) is emitted but does not affect the response.
- This route MUST appear before any GET `/:slug` catch-all to avoid route shadowing.

---

## 3. POST /themes/:slug/publish

**Status:** EXISTING route (Phase P adds idempotency and audit event)
**Purpose:** Publish the current draft as an immutable release. Optionally makes the store live on the new release.

### Request

```typescript
// PublishThemeSchema
{
  store_id: string;             // uuid
  theme_id: string;             // slug (= :slug path param)
  release_config: Record<string, unknown>;  // full template config to publish
  make_store_live?: boolean;    // default false — if true, updates sites.current_theme_release_id
  publish_message?: string;     // human note for the release record
  source_draft_id?: string;     // uuid — draft this was created from
  source_draft_version?: number; // OCC version of the source draft
  idempotency_key?: string;     // min 8, max 200 chars — ADDED Phase P; recommended for all callers
}
```

### Response (200 OK)

```typescript
{
  release_id: string;           // uuid of the created release
  release_version: number;      // auto-incremented integer
  release_status: 'published';
  is_current: boolean;
  published_at: string;         // ISO 8601
  // ... full release record fields
}
```

On idempotency hit (pre-check finds existing release with same `store_id` + `idempotency_key`):
- Returns the existing release record with the same shape as above.
- No second RPC call, no audit event (duplicate suppression).

### Error Responses

| Code | Condition |
|---|---|
| 400 Bad Request | Invalid request body |
| 401 Unauthorized | Missing or invalid merchant token |
| 403 Forbidden | `store_id` not owned by authenticated merchant |
| 409 Conflict | Draft CAS conflict (stale `source_draft_version`) |

### Idempotency Contract

- Supply `idempotency_key` for all publish calls to prevent duplicate releases on network retry.
- Minimum 8 characters; maximum 200 characters.
- Scoped to `store_id` — the same key string on a different store is treated as a different key.
- Sequential retry: pre-check returns existing release immediately (no second RPC call).
- Concurrent retry (~1-5ms window): the partial unique index prevents a second keyed release; one keyless ghost release may be created in the narrow window (TOCTOU residual — ARB-gated).

### Known TOCTOU Residual

Concurrent publishes within the ~1-5ms window can both pass the TS-layer pre-check and call `publish_theme_release` RPC. The second call may create a ghost keyless release. Full closure requires ARB to add `p_idempotency_key` to the SECURITY DEFINER RPC.

---

## 4. POST /themes/:slug/releases/:releaseId/rollback

**Status:** EXISTING route (Phase P adds CAS guard and audit event)
**Purpose:** Roll back to a specific previous release. Creates a new published release pointing back at `releaseId` as the rollback source.

### Request

```typescript
// RollbackThemeReleaseSchema
{
  store_id: string;                          // uuid
  theme_id: string;                          // slug
  rollback_message?: string;                 // human note
  make_store_live?: boolean;                 // default true for rollback
  expected_current_release_id?: string;      // uuid — ADDED Phase P; recommended CAS guard
}
```

### Response (200 OK)

```typescript
{
  release_id: string;           // uuid of the new (rollback) release
  release_version: number;
  release_status: 'published';
  rollback_of_release_id: string;  // = :releaseId from path
  is_current: boolean;
  published_at: string;
  // ... full release record fields
}
```

### Error Responses

| Code | Condition |
|---|---|
| 400 Bad Request | Invalid request body |
| 401 Unauthorized | Missing or invalid merchant token |
| 403 Forbidden | `store_id` not owned by authenticated merchant |
| 404 Not Found | `:releaseId` not found for this store |
| 409 Conflict | `expected_current_release_id` supplied but does not match the actual current release (race condition detected) |

### CAS Guard Contract

- Supply `expected_current_release_id` to enable race detection.
- Value: the `id` of the release the client believes is currently active (obtained from a prior `listReleases` or `publish` call).
- If the actual current release differs (another publish or rollback occurred concurrently), the gateway returns **409 Conflict** instead of blindly rolling back.
- If `expected_current_release_id` is omitted, the CAS guard is skipped (backward-compatible with existing callers).
- The Phase R editor MUST supply this field.

### Known TOCTOU Residual

The CAS check is TS-level only. Two concurrent rollbacks both passing the check in the same narrow window can both call `publishReleaseSnapshot`; the second write wins `is_current`. Full closure requires ARB to add `p_expected_current_release_version` to the SECURITY DEFINER RPC.

---

## 5. GET /themes/:slug/releases (existing, listed for completeness)

**Status:** EXISTING — unchanged by Phase P
**Purpose:** List all releases for a store's theme.

### Request

Query parameters: `store_id=<uuid>`

### Response (200 OK)

Array of release records ordered by `release_version DESC`. Each record includes all `theme_releases` columns. The client SHOULD use the `id` of the first result with `is_current=true` as the `expected_current_release_id` for a subsequent rollback call.

---

---

## 6. GET /themes/library

**Status:** NEW (added Phase Q)  
**Purpose:** List all themes installed on a store, with per-theme metadata: draft state, publish state, and update availability.  
**Auth:** ES256 merchant token + `verifyStoreOwner` (required for all Phase Q library routes).  
**Requires:** Migration 190 (`190_theme_library_q.sql`) applied.

### Request

Query parameters: `store_id=<uuid>` (required; `ListSiteThemesQuerySchema`)

### Response (200 OK)

```typescript
{
  themes: Array<{
    slug: string;
    name: string;
    instance_status: 'installed' | 'archived' | 'deleted';
    installed_at: string;           // ISO 8601
    last_published_at: string | null;
    last_modified_at: string | null;
    hasDraft: boolean;
    isCurrentlyPublished: boolean;  // derived from sites.theme_id === slug
    updateAvailable: boolean;
    theme_package_version_id: string | null;
    active_release_id: string | null;
  }>;
}
```

### Error Responses

| Code | Condition |
|---|---|
| 400 Bad Request | `store_id` missing or not a UUID |
| 401 Unauthorized | Missing or invalid merchant token |
| 403 Forbidden | `store_id` not owned by authenticated merchant |

### Tenancy Notes

`verifyStoreOwner` is the first adapter call. All sub-queries (theme_instances, theme_releases, theme_editor_drafts) carry `.eq('store_id', storeId)` as the first filter. Site-private themes (`is_active=false`) are included in the listing; the public marketplace catalog (`GET /themes`) continues to exclude them.

---

## 7. POST /themes/library/create

**Status:** NEW (added Phase Q)  
**Purpose:** Create a blank site-private theme. The new theme is not visible in the public marketplace catalog (`is_active=false`, `is_site_private=true`).

### Request

```typescript
// CreateSiteThemeSchema
{
  store_id: string;        // uuid
  name: string;            // 1–120 characters
  template_slug?: string;  // optional starting template
}
```

### Response (200 OK)

```typescript
{
  slug: string;        // generated uuid-based slug (e.g. "site-theme-<uuid>")
  instance_id: string; // uuid of the created theme_instances row
  name: string;
}
```

### Error Responses

| Code | Condition |
|---|---|
| 400 Bad Request | Name empty or > 120 chars |
| 401 Unauthorized | Missing or invalid merchant token |
| 403 Forbidden | `store_id` not owned by authenticated merchant |
| 409 Conflict | `THEME_LIMIT_REACHED` — store has reached its plan's theme cap |

### Plan Limit Contract

`verifyStoreOwner` is called before `resolveStoreThemeLimit`. A cross-tenant `store_id` returns 403 without reading the foreign store's billing data. The limit is plan-tier-driven (`billing-core`): free=1, starter=3, business=10, enterprise=unlimited, launch=3, growth=5. The count+insert is non-atomic (see RISK-TOCTOU-Q01).

### Audit Event

`theme.create` emitted after successful insert.

---

## 8. POST /themes/:slug/duplicate

**Status:** NEW (added Phase Q)  
**Purpose:** Duplicate an installed theme (marketplace or site-private). The duplicate is always site-private to this store.

### Request

```typescript
// DuplicateSiteThemeSchema
{
  store_id: string;  // uuid
  name?: string;     // 1–120 chars; defaults to "<original name> (copy)" if omitted
}
```

### Response (200 OK)

```typescript
{
  slug: string;        // new uuid-based slug
  instance_id: string;
  name: string;
  source_slug: string; // slug of the duplicated theme
}
```

### Error Responses

| Code | Condition |
|---|---|
| 401 Unauthorized | Missing or invalid merchant token |
| 403 Forbidden | `store_id` not owned by authenticated merchant |
| 404 Not Found | `:slug` not found as an installed theme for this store (enumeration prevention — not 403) |
| 409 Conflict | `THEME_LIMIT_REACHED` — plan cap exceeded |

### Enumeration Prevention

If the source theme_instances row is not found for this store, the adapter returns `NotFoundError` (404), not `ForbiddenError` (403). This prevents a merchant from learning which theme slugs are installed in other stores by distinguishing "forbidden" from "not found."

### Audit Event

`theme.duplicate` emitted.

---

## 9. PATCH /themes/:slug/rename

**Status:** NEW (added Phase Q)  
**Purpose:** Rename a site-private theme. Marketplace themes (shared catalog rows) cannot be renamed — the merchant must duplicate first.

### Request

```typescript
// RenameSiteThemeSchema
{
  store_id: string;  // uuid
  name: string;      // 1–120 characters (required)
}
```

### Response (200 OK)

```typescript
{
  slug: string;
  name: string;  // new name
}
```

### Error Responses

| Code | Condition |
|---|---|
| 400 Bad Request | Name empty or > 120 chars |
| 401 Unauthorized | Missing or invalid merchant token |
| 403 Forbidden | `store_id` not owned by authenticated merchant; OR theme has `owned_by_site_id IS NULL` (marketplace theme); OR `owned_by_site_id` belongs to a different store |

### Catalog Integrity

Three layers prevent a merchant from mutating a shared marketplace theme catalog row:

1. `verifyStoreOwner` blocks cross-tenant `store_id`.
2. Application-level: `themes.owned_by_site_id` is read; if `null` or not equal to `storeId`, throws `ForbiddenError` (message: "Marketplace themes cannot be renamed. Duplicate the theme first...").
3. DB-level: the UPDATE carries `.eq('owned_by_site_id', storeId)` — if check (2) were bypassed, the UPDATE matches zero rows.

### Audit Event

`theme.rename` emitted.

---

## 10. POST /themes/:slug/archive

**Status:** NEW (added Phase Q)  
**Purpose:** Archive an installed (non-published) theme instance. Sets `instance_status='archived'` on the `theme_instances` row. Cannot archive the currently published theme.

### Request

```typescript
// ArchiveSiteThemeSchema
{
  store_id: string;  // uuid
}
```

### Response (200 OK)

```typescript
{
  slug: string;
  instance_status: 'archived';
}
```

### Error Responses

| Code | Condition |
|---|---|
| 401 Unauthorized | Missing or invalid merchant token |
| 403 Forbidden | `store_id` not owned by authenticated merchant |
| 409 Conflict | `THEME_CURRENTLY_PUBLISHED` — theme is the store's active live theme |

### Published-Theme Block

`sites.theme_id` is read (scoped by `store_id`); if it equals `:slug`, the route returns 409 `THEME_CURRENTLY_PUBLISHED`. The merchant must publish a different theme before archiving this one.

### Audit Event

`theme.archive` emitted.

---

## 11. DELETE /themes/:slug/unpublished

**Status:** NEW (added Phase Q)  
**Purpose:** Soft-delete an unpublished theme instance. Sets `deleted_at=now()` and `instance_status='deleted'` on the `theme_instances` row. Cannot delete the currently published theme.

### Request

Query parameters: `store_id=<uuid>` (required; `DeleteUnpublishedThemeQuerySchema`)

### Response (200 OK)

```typescript
{
  slug: string;
  deleted: true;
}
```

### Error Responses

| Code | Condition |
|---|---|
| 400 Bad Request | `store_id` missing or not a UUID |
| 401 Unauthorized | Missing or invalid merchant token |
| 403 Forbidden | `store_id` not owned by authenticated merchant |
| 409 Conflict | `CANNOT_DELETE_PUBLISHED_THEME` — theme is published (either via sites.theme_id or theme_releases.is_current=true) |

### Two-Layer Published-Theme Block

1. `sites.theme_id` check (scoped by `store_id`): if equals `:slug` → 409.
2. `theme_releases WHERE store_id=storeId AND theme_id=slug AND is_current=true` check: if found → 409. This second guard handles edge cases where `sites.theme_id` may not reflect the most recent publish.

### Soft-Delete Semantics

The `theme_instances` row is not hard-deleted. `deleted_at` is set and `instance_status` is set to `'deleted'`. The `themes` catalog row (if site-private) is not deleted; it remains accessible for potential recovery.

### Audit Event

`theme.delete` emitted.

---

## 12. Common Error Shape

All errors follow the gateway's standard error envelope:

```typescript
{
  error: string;   // machine-readable error code (e.g. 'FORBIDDEN', 'VALIDATION_ERROR', 'CONFLICT')
  message: string; // human-readable description
  details?: unknown; // optional structured detail (e.g. Zod error issues)
}
```

---

## 13. Schema Version Notes

- `ThemeDocument` V2: `schema_version: "2.0.0"` — defined by `packages/theme-engine/src/theme-document.ts` `THEME_DOCUMENT_VERSION`. The validate route verifies the supplied document is V2 or can be migrated to V2.
- `LiquidThemePackageBundle` G4: defined by `packages/theme-engine/src/theme-bundle.ts` `parseLiquidThemePackageBundle`.
- Rollback created releases always use the same `schema_manifest_version` as the release being rolled back to.

### 13.1 Nested Blocks (Phase T)

Phase T extends both the `ThemeDocument` V2 and `LiquidThemePackageBundle` block shapes to support recursive nesting. The changes are backward-compatible for all callers:

**`ThemeDocumentBlock`** (document layer, `theme-document.ts`):

```typescript
interface ThemeDocumentBlock {
  id: string;
  type: string;
  settings: Record<string, ThemeBundleJson>;
  disabled: boolean;
  children: ThemeDocumentBlock[];   // recursive; always present (defaults to [])
}
```

`children` was already present in the schema from Phase N. Phase T activates the full round-trip: `fromThemeDocumentV2` now serialises `children[]` recursively into `ThemeBundleTemplateBlock.blocks` + `block_order`.

**`ThemeBundleTemplateBlock`** (bundle layer, `theme-bundle.ts`):

```typescript
interface ThemeBundleTemplateBlock {
  type: string;
  settings: Record<string, ThemeBundleJson>;
  disabled: boolean;
  blocks: Record<string, ThemeBundleTemplateBlock>;   // keyed child blocks (Phase T)
  block_order: string[];                               // ordered child ids (Phase T)
}
```

`blocks` and `block_order` default to `{}` and `[]` respectively. Existing flat-block bundles that omit these fields parse correctly via Zod defaults.

**`ThemeLiquidReusableBlockSchema`** (block-type catalog, `theme-bundle.ts`):

```typescript
{
  // ...existing fields...
  schema: {
    // ...
    allowed_child_types?: string[];  // Phase T — restrict which child block types are permitted
  }
}
```

`allowed_child_types` is optional; omitting it means the block type accepts any child type. When present, `parseThemeDocument` enforces that all `ThemeDocumentBlock.children[].type` values are in the set.

**Depth bound:** All three parse layers enforce a maximum block nesting depth of **3**:

| Constant | Value | Enforcement point |
|---|---|---|
| `MAX_BLOCK_NESTING_DEPTH` | 3 | `ThemeDocumentSchema.superRefine` — document parse |
| `MAX_BUNDLE_BLOCK_NESTING_DEPTH` | 3 | `ThemeBundleTemplateSectionSchema.superRefine` — bundle parse |
| `RENDERER_MAX_BLOCK_DEPTH` (private) | 3 | `renderLiquidSectionBlocks` recursion cap — render time |

Depth is counted as: flat blocks = 1; one level of children = 2; grandchildren = 3. Inputs exceeding depth 3 are rejected at parse time with a ZodError containing the message `Block nesting depth N exceeds maximum 3`.

**`sub_blocks` in Liquid:** Parent block Liquid templates can iterate rendered child blocks via the `block.sub_blocks` drop:

```liquid
{% for sub in block.sub_blocks %}
  <div class="sub-block">{{ sub.content }}</div>
{% endfor %}
```

Each `sub_blocks[]` entry has: `id`, `type`, `settings`, `content` (rendered HTML), `html` (alias for `content`), `is_app_block`.

**`BlockModel` (SDK layer):**

```typescript
interface BlockModel {
  id: string; type: string; order: number;
  rendererKey?: string; schemaVersion?: string;
  settings: Record<string, unknown>; isVisible: boolean;
  children?: BlockModel[];   // Phase T — additive, optional; absent on flat/legacy blocks
}
```

`children` is optional so all existing `BlockModel` consumers compile without change.

---

## 14. Rate Limiting and Idempotency Best Practices

| Operation | Recommended client behaviour |
|---|---|
| Publish | Always supply `idempotency_key`; retry up to 3× on 5xx; do not retry on 4xx |
| Rollback | Always supply `expected_current_release_id`; do not retry on 409 (read new current first) |
| Validate | Idempotent by design; retry freely on 5xx; stop on 400 (schema error) |
| List releases | Idempotent; cache for 60s; refresh before a rollback call |
| List library (GET /library) | Idempotent; retry freely on 5xx |
| Create theme | Not idempotent — do not retry on 5xx without checking if the theme was created |
| Duplicate theme | Not idempotent — same caveat as create |
| Rename theme | Idempotent (same name = same result); retry freely on 5xx |
| Archive theme | Idempotent for the same slug; retry freely on 5xx; stop on 409 |
| Delete (soft-delete) | Idempotent for the same slug (already-deleted → 200); retry freely on 5xx; stop on 409 |
