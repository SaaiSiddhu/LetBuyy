# Theme Platform API Contracts

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Last updated:** 2026-07-10 (post Phase P)
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

## 6. Common Error Shape

All errors follow the gateway's standard error envelope:

```typescript
{
  error: string;   // machine-readable error code (e.g. 'FORBIDDEN', 'VALIDATION_ERROR', 'CONFLICT')
  message: string; // human-readable description
  details?: unknown; // optional structured detail (e.g. Zod error issues)
}
```

---

## 7. Schema Version Notes

- `ThemeDocument` V2: `schema_version: "2.0.0"` — defined by `packages/theme-engine/src/theme-document.ts` `THEME_DOCUMENT_VERSION`. The validate route verifies the supplied document is V2 or can be migrated to V2.
- `LiquidThemePackageBundle` G4: defined by `packages/theme-engine/src/theme-bundle.ts` `parseLiquidThemePackageBundle`.
- Rollback created releases always use the same `schema_manifest_version` as the release being rolled back to.

---

## 8. Rate Limiting and Idempotency Best Practices

| Operation | Recommended client behaviour |
|---|---|
| Publish | Always supply `idempotency_key`; retry up to 3× on 5xx; do not retry on 4xx |
| Rollback | Always supply `expected_current_release_id`; do not retry on 409 (read new current first) |
| Validate | Idempotent by design; retry freely on 5xx; stop on 400 (schema error) |
| List releases | Idempotent; cache for 60s; refresh before a rollback call |
