# LCIS Theme Operations Discovery

Generated: 2026-06-18
Sources: `services/api-gateway/src/routes/themes.ts`, `services/api-gateway/src/execution/theme-execution.adapter.ts`, `apps/merchant-control-plane/src/app/api/themes/**`

---

## 1. Complete Theme Operations Inventory

### All API Operations That Currently Exist

All gateway routes live under `/v1/themes` (Hono, Cloudflare Worker). The merchant-control-plane BFF routes (`/api/themes/...`) are thin Next.js proxies that call the gateway; they do not have their own DB access.

| # | Operation | Method | Gateway Endpoint | MCP BFF Endpoint | Auth Layer | DB Operation | LCIS-Callable? | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | List available themes (catalog) | GET | `/themes` | `/api/themes` | `optionalAuth` (store-scoped requires auth) | `themes` table read; `store_themes` join if `store_id` provided | Yes | Supports pagination, filter by category/pricing/industry/tag/feature/layout; enriches with `installed`/`active` flags per store |
| 2 | Get theme categories | GET | `/themes/categories` | — | None | `themes` table read | Yes | Returns distinct `category` values from active themes |
| 3 | Get theme industries | GET | `/themes/industries` | — | None | `themes` table read | Yes | Returns distinct `industry` values from active themes |
| 4 | Get theme details by slug | GET | `/themes/:slug` | — | None | `themes` + `theme_reviews` read | Yes | Includes full review list + rating summary |
| 5 | Get theme schema (editable schemas) | GET | `/themes/:slug/schema` | `/api/themes/[themeId]/sections` | `authMiddleware` | `themes` read + schema registry resolve | Yes | Returns `section_schemas`, `block_schemas`, `settings_schema`, `template_schema`, `layout_schema`, `renderer_manifest` |
| 6 | Load theme editor state | GET | `/themes/:slug/editor?store_id=` | `/api/themes/[themeId]/editor` | `authMiddleware` | `sites`, `themes`, `theme_editor_drafts`, `theme_releases`, `theme_instances` read | Yes | Returns full editor payload: `template_config`, draft, release, schemas, `theme_instance_id`, `version` |
| 7 | Save theme draft (auto-save) | PUT | `/themes/:slug/editor/draft` | `POST /api/themes/[themeId]/editor/draft` | `authMiddleware` | `theme_editor_drafts` upsert; `theme_instance_drafts` upsert; `theme_draft_patches` insert; domain event emitted | Yes | Validates against schema, bumps version, checks `base_version` for stale-session conflict |
| 8 | Discard theme draft | DELETE | `/themes/:slug/editor/draft?store_id=` | `DELETE /api/themes/[themeId]/editor/draft` | `authMiddleware` | `theme_editor_drafts` delete; domain event emitted | Yes | Template-key-scoped; falls back to legacy single-draft for pre-migration schemas |
| 9 | Publish draft to live store | POST | `/themes/:slug/publish` | `PUT /api/themes/[themeId]/editor` | `authMiddleware` | Calls `publish_theme_release` RPC (or fallback direct insert); `sites` update; `theme_releases` insert; cache purge | Yes | Triggers `bumpStorefrontCacheVersion` + `purgeStorefrontCache` after publish; `make_store_live` controls site status |
| 10 | Create preview session | POST | `/themes/:slug/preview-session` | `POST /api/themes/[themeId]/preview-session` | `authMiddleware` | `theme_preview_sessions` insert; audit event emitted | Yes | Requires a saved draft to exist; returns signed `preview_token` + `expires_at`; TTL configurable (default 900 s) |
| 11 | List theme releases | GET | `/themes/:slug/releases?store_id=` | `GET /api/themes/[themeId]/releases` | `authMiddleware` | `theme_releases` read (ordered by `release_version` desc) | Yes | Returns full release history with `release_status`, `is_current`, `publish_message`, `rollback_of_release_id` |
| 12 | Rollback to a release | POST | `/themes/:slug/releases/:releaseId/rollback` | `POST /api/themes/[themeId]/releases/[releaseId]/rollback` | `authMiddleware` | Calls `publish_theme_release` RPC with `rollback_of_release_id`; `sites` update; cache purge | Yes | Restores `template_snapshot` (or `release_config`); creates a new release record pointing back to the source |
| 13 | Install theme to store | POST | `/themes/:slug/install` | `POST /api/themes/install` | `authMiddleware` | `store_themes` upsert (sets `is_active`); `theme_instances` upsert; calls `publish_theme_release` RPC; domain event emitted | Yes | Checks purchase entitlement for premium themes; deactivates all other `store_themes` for that store |
| 14 | Upload theme package (bundle) | POST | `/themes/packages/upload` | `POST /api/themes/install` (with `bundle`) | `authMiddleware` | `schema_registry` write via `SchemaRegistryExecutionAdapter.uploadThemePackageBundle`; marketplace review record created; `theme.submitted` event emitted | Partially | `submission_mode` is `marketplace` (default) or `private_install`; LCIS can call with `private_install` to bypass review |
| 15 | Purchase theme (Razorpay or free) | POST | `/themes/:slug/purchase` | — | `authMiddleware` | `theme_purchases` upsert; Razorpay order created (live) or sandbox bypass; `theme_purchase_receipts` upsert; domain event emitted | No | Requires Razorpay keys in production; sandbox auto-completes in dev |
| 16 | Verify Razorpay payment | POST | `/themes/:slug/purchase/verify` | — | `authMiddleware` | `theme_purchases` update; `theme_purchase_receipts` upsert; audit + domain event emitted | No | HMAC-SHA256 signature verification (timing-safe); GST receipt issued |
| 17 | List reviews | GET | `/themes/:slug/reviews` | — | None | `theme_reviews` read | Yes | Paginated; includes rating summary |
| 18 | Create review | POST | `/themes/:slug/reviews` | — | `authMiddleware` | `theme_reviews` upsert | No | Gated on verified purchase (`theme_purchases.status = 'completed'`) |
| 19 | Reply to review | POST | `/themes/:slug/reviews/:reviewId/reply` | — | `authMiddleware` | `theme_reviews` update (`developer_reply`) | No | Gated on theme authorship (`developer_profiles.handle`) |
| 20 | Download theme artifact | GET | `/themes/:slug/downloads/:platform` | — | `authMiddleware` | `theme_download_artifacts` read; entitlement check via `theme_purchases` | No | Returns signed URL (data URI in local dev; live object store URL when configured) |
| 21 | Report theme | POST | `/themes/:slug/reports` | — | `authMiddleware` | `theme_reports` insert | No | |
| 22 | Request theme refund | POST | `/themes/:slug/refunds` | — | `authMiddleware` | `theme_refund_requests` insert | No | Provider refund execution is live-gated separately |
| 23 | Reorder sections | PUT | — | `PUT /api/themes/[themeId]/sections/reorder` | Merchant session (Next.js auth) | Calls `loadEditor` + `saveDraft` (read-modify-write) | Partially | No atomic gateway endpoint; BFF reads editor state then re-saves draft with reordered sections; race condition possible |

---

## 2. Operation Classification

### Group A: Already API-Driven (callable programmatically)

These operations are full REST API endpoints with authentication + DB operations. An LLM agent with a valid merchant JWT can call them directly against the gateway at `/v1/themes/...`.

| Operation | Gateway Endpoint | Evidence |
|---|---|---|
| List themes catalog | `GET /themes` | Public + optional auth; fully parameterised |
| Get theme details | `GET /themes/:slug` | No auth required; returns schemas + reviews |
| Get editable schema | `GET /themes/:slug/schema` | Auth-gated; returns full section/block/settings/layout schemas |
| Load editor state | `GET /themes/:slug/editor?store_id=` | Auth-gated; returns template_config, draft, release, all schemas |
| Save draft | `PUT /themes/:slug/editor/draft` | Full idempotency via `base_version`; versioned draft; audit trail |
| Discard draft | `DELETE /themes/:slug/editor/draft` | Auth-gated; template-key-scoped |
| Publish draft | `POST /themes/:slug/publish` | Calls `publish_theme_release` RPC; cache purge; immutable release created |
| Create preview session | `POST /themes/:slug/preview-session` | Returns signed token; TTL configurable |
| List releases | `GET /themes/:slug/releases?store_id=` | Auth-gated; full history with metadata |
| Rollback to release | `POST /themes/:slug/releases/:releaseId/rollback` | Creates new release from snapshot; cache purge |
| Install theme | `POST /themes/:slug/install` | Full install + publish + event; free themes require no purchase |

### Group B: Partially API-Driven (API exists but requires UI context or session state)

| Operation | Endpoint | What UI State It Depends On |
|---|---|---|
| Upload theme package | `POST /themes/packages/upload` | Requires a pre-built `bundle` JSON object (only the theme editor or a developer CLI constructs this today); `submission_mode` defaults to marketplace review flow |
| Section reorder | `PUT /api/themes/[themeId]/sections/reorder` (BFF only) | No atomic gateway endpoint; BFF performs a read-modify-write against `saveDraft`; caller must supply correct `store_name` from merchant session; race condition if editor is open simultaneously |
| Publish store (toggle live) | `POST /api/themes/publish` (BFF only) | Calls `stores.publish()` / `stores.update()`; is actually store status, not a theme operation; re-exposed under `/themes/publish` misleadingly |

### Group C: UI-Only (no API, only works through browser interaction)

| Operation | What Would Be Needed to Make It API-Driven |
|---|---|
| Duplicate theme / copy theme settings from one store to another | A `POST /themes/:slug/duplicate?store_id=` gateway endpoint that loads current `template_config` and calls `installTheme` + `saveDraft` atomically |
| Update individual section settings in-draft (without replacing full `template_config`) | A `PATCH /themes/:slug/editor/sections/:sectionId` endpoint that applies a partial update rather than replacing the entire config JSON |
| Add a new section to a template | Same as above; currently the full `template_config` is always sent back |
| Remove a section from a template | Same as above |
| Set theme color preset / apply a preset | No preset endpoint exists; UI manually constructs `themeSettings` and calls `saveDraft` |
| Preview a specific release (not just current draft) | The preview-session endpoint is draft-only; no `?release_id=` parameter |
| Change the active storefront theme without install (activate an already-installed theme) | The install endpoint deactivates all others and sets `is_active`; no lightweight "activate existing installation" endpoint |

### Group D: Missing Operations (needed but don't exist)

| Missing Operation | Evidence of Absence | LCIS / Agent Impact |
|---|---|---|
| `GET /themes/:slug/bundle` — read the current live release bundle/config as a structured object | Editor loads full editor state but does not expose a standalone "read the live bundle" endpoint | LCIS cannot read current production theme config without loading the full editor (which may create side-effects via `ensureThemeInstance`) |
| `PATCH /themes/:slug/editor/sections/:sectionId` — atomic single-section update | Every section write requires transmitting + replacing the entire `template_config` | Agents would cause large unnecessary payloads and data races |
| `POST /themes/:slug/apply-preset` — apply a named preset to `themeSettings` | No preset concept at API level; UI constructs it manually | AI preset application requires loading schema + current config, constructing new `themeSettings`, then calling `saveDraft` |
| `GET /themes/store/:storeId/active` — get the active theme + current live config for a store in one call | Requires a `GET /themes?store_id=&limit=1` + checking `active=true` in result | Needed for LCIS "what theme is this store running" without opening the editor |
| `POST /themes/:slug/editor/sections/bulk-update` — batch update multiple sections atomically | No bulk patch; only full config replace | Required for AI-driven layout redesign without multiple race-prone saves |
| `GET /themes/:slug/releases/:releaseId` — get a specific release's full config/snapshot | `listReleases` returns metadata but not `release_config`/`template_snapshot` body | AI rollback analysis requires reading what a release actually contained before deciding to roll back |
| `POST /themes/:slug/activate` — activate an already-installed theme without a full re-install | Install is idempotent but heavyweight (runs schema validation + publishes a new release) | Needed for fast theme switching between already-installed themes |
| `GET /themes/store/:storeId/history` — unified theme change log (installs + publishes + rollbacks) | Only per-theme releases exist; no cross-theme timeline for a store | LCIS incident analysis needs to know "what changed on this store in the last N events" |

---

## 3. LCIS Tool Candidates

If LCIS had a "Theme Intelligence" module, these would be the most valuable operations:

| Tool Name | Purpose | Required API | Status | Blocker |
|---|---|---|---|---|
| `inspect_active_theme` | Read current live theme slug, `template_config`, and release version for a store | `GET /themes?store_id=&limit=50` + active flag | Possible now | Requires loading catalog with store filter; no dedicated "active theme" endpoint |
| `get_theme_schema` | Return the full settings/section/block/layout schema for a theme so an LLM can reason about it | `GET /themes/:slug/schema` | Ready | None; endpoint exists and is LCIS-callable |
| `read_live_editor_state` | Load full editor state (template_config + draft + release metadata + schemas) for a theme+store | `GET /themes/:slug/editor?store_id=` | Ready | None; side-effect: `ensureThemeInstance` may mutate `theme_instances` on first call |
| `apply_preset` | Set `themeSettings` in draft to a preset JSON and save | `PUT /themes/:slug/editor/draft` (after loading schema) | Possible now | No dedicated preset endpoint; LLM must construct the full config; risk of overwriting other template keys |
| `update_section` | Modify a section's settings in draft | `PUT /themes/:slug/editor/draft` (full config replace) | Possible now but imprecise | No `PATCH /sections/:id` endpoint; must read + merge + replace full config |
| `publish_draft` | Promote current draft to live release | `POST /themes/:slug/publish` | Ready | None; all params available programmatically |
| `rollback_theme` | Revert to a previous release | `POST /themes/:slug/releases/:releaseId/rollback` | Ready | Must first call `listReleases` to discover `releaseId` |
| `list_theme_history` | View all releases with metadata (version, date, message, is_current, rollback_of) | `GET /themes/:slug/releases?store_id=` | Ready | None |
| `install_theme` | Install (and activate) a theme from marketplace to a store | `POST /themes/:slug/install` | Ready | Premium themes require completed purchase first; LCIS cannot purchase |
| `generate_preview_url` | Get a signed preview session URL for the current draft | `POST /themes/:slug/preview-session` | Ready | Requires a saved draft to exist; TTL is 900 s default |
| `duplicate_theme` | Create a copy of a theme's config on the same or another store for safe editing | Not available | Blocked | No gateway endpoint; would require read-current-config + install + save-draft sequence |
| `activate_theme` | Set an already-installed theme as active without a full re-install | `POST /themes/:slug/install` (idempotent) | Possible but heavyweight | Re-runs schema validation + publishes a new release; no lightweight activate operation |
| `read_release_snapshot` | Get the full `template_config` of a specific past release | Not available (listReleases returns metadata only) | Blocked | Missing `GET /themes/:slug/releases/:releaseId` endpoint |
| `bulk_section_update` | Apply AI-generated layout changes to multiple sections atomically | Not available | Blocked | No bulk-patch endpoint; full config replace required |

---

## 4. Authentication & Authorization Analysis

### Token Types Required

| Operation Category | Required Token | Notes |
|---|---|---|
| Read-only catalog (list, schema, reviews) | None (public) or optional merchant JWT | `GET /themes`, `GET /themes/:slug`, `GET /themes/:slug/schema` require no auth; `store_id`-scoped reads require ES256 merchant JWT |
| All write operations | ES256 merchant JWT (`LETBUYY_IDENTITY_PUBLIC_JWKS`) | Issued by `identity-platform`; short-lived; verified by gateway `authMiddleware` |
| Preview session creation | ES256 merchant JWT | Token is SHA-256 hashed before storage; raw token returned once |
| Purchase/payment | ES256 merchant JWT + Razorpay HMAC | Payment verification uses `timingSafeEqualHex` for timing-safe comparison |

### Ownership Verification

Every write operation calls `ThemeExecutionAdapter.verifyStoreOwner(storeId, userId)` which checks `sites.custom_user_id = userId OR sites.user_id = userId`. This is the only tenancy check — there is no RLS involved in the adapter; the adapter uses service-role Supabase client (`getSupabaseAdmin`). The gateway sits behind `verifySiteOwnership` at the middleware layer.

### Rate Limits

No explicit rate-limit middleware is applied to theme write routes in the source reviewed. Rate limiting is expected to be enforced at the Cloudflare Worker layer (not visible in route code).

### Idempotency Guarantees

| Operation | Idempotency Mechanism |
|---|---|
| Save draft | `base_version` conflict check (throws `ConflictError` if stale); draft upsert on `(store_id, theme_id, template_key)` |
| Publish | `publish_theme_release` RPC is the authoritative publish path; fallback uses manual `is_current` flag management; no explicit `idempotency_key` on the publish call itself |
| Rollback | Creates a new release pointing to `rollback_of_release_id`; not idempotent (calling twice creates two releases) |
| Install | `store_themes` upsert on `(store_id, theme_id)` is idempotent at the row level; `theme_instances` upsert on `(store_id, theme_package_id)` is idempotent; event emission uses `idempotencyKey: theme.installed:<storeId>:<packageId>:<installationId>` |
| Preview session | Not idempotent; each call creates a new session row |

### Audit Trail

All write operations emit structured events via `EventExecutionAdapter`:
- `theme.draft.saved` (domain event + audit event)
- `theme.draft.discarded` (domain event)
- `theme.installed` (domain event)
- `theme.submitted` (domain event on package upload)
- `theme.preview_session.create` (audit event only)
- `theme.purchase.completed` + `theme.purchase.payment_order_created` (domain + audit)

---

## 5. Missing Operations for Full AI Theme Control

The following operations are currently absent from the API and would be required for complete AI-driven theme management. Evidence for absence is the lack of any matching route in `themes.ts` or the execution adapter.

1. **`GET /themes/:slug/releases/:releaseId`** — read the full `release_config` / `template_snapshot` for a specific release ID. Currently `listReleases` returns only metadata fields (`release_version`, `release_status`, `is_current`, `publish_message`, `published_at`, `rollback_of_release_id`). An AI agent evaluating whether to roll back cannot read what the release actually contained without this endpoint.

2. **`POST /themes/:slug/activate`** — lightweight activation of an already-installed theme. The only current path is `POST /themes/:slug/install`, which is idempotent at the DB level but runs full schema validation, a new `publish_theme_release` RPC call, cache purge, and event emission every time. For an agent that needs to switch between two already-installed themes quickly, this is disproportionately expensive.

3. **`PATCH /themes/:slug/editor/sections/:sectionId`** — update a single section's settings within the current draft. Today all section changes require the caller to transmit the entire `template_config` JSON. For AI-driven section edits this creates: (a) a large payload per operation, (b) a race condition if the agent and a concurrent editor session both read and write `template_config`, and (c) risk of silently dropping changes to sections the agent did not intend to touch.

4. **`POST /themes/:slug/duplicate`** or **`POST /themes/:slug/clone?target_store_id=`** — create a copy of a theme's live configuration for safe editing. There is no atomic "copy this store's current theme config into a new draft on another store" operation. The agent must manually chain: load editor → extract `template_config` → install on target → save draft. This is not atomic and can partially fail.

5. **`GET /themes/store/:storeId/active`** — get the active theme slug and current live config for a store in a single call. Currently requires listing the catalog with `store_id` parameter and searching for `active: true`, which is paginated and may not return the active theme on the first page if the store's theme is unpopular in the catalog.

6. **`POST /themes/:slug/editor/sections/bulk-patch`** — atomically update multiple sections' settings in one request. An AI agent redesigning a layout touches 5–15 sections at once; without bulk update it must either (a) call `saveDraft` 5–15 times (slow, with version conflicts) or (b) construct the full config object itself (brittle, no partial-update semantics).

7. **`POST /themes/:slug/apply-preset`** — apply a named preset (e.g., `minimal`, `bold`, `elegant`) to `themeSettings`. There is no concept of a preset at the API level; the UI constructs the settings object manually. An AI agent wishing to suggest and apply a preset must reconstruct the full `themeSettings` key from the schema, which is high-risk for correctness.

8. **`GET /themes/store/:storeId/timeline`** — unified change log showing all theme events (installs, publishes, rollbacks) across all themes for a store, in chronological order. Currently the `theme_releases` table is per-(store, theme_id); an agent investigating an incident cannot get a cross-theme timeline without querying per-theme separately.

---

## 6. Recommended LCIS Integration Architecture

### Tier 1 — Read-Only Intelligence (inspect, analyze, recommend)

These operations are safe for LCIS to call autonomously. They are non-mutating, carry no audit cost, and can be called at any time.

- `get_theme_schema` → `GET /themes/:slug/schema` — inspect available sections/blocks/settings for any theme
- `list_theme_history` → `GET /themes/:slug/releases?store_id=` — understand the release timeline
- `inspect_catalog` → `GET /themes?store_id=&limit=50` — discover what is installed and active per store
- `read_editor_state` → `GET /themes/:slug/editor?store_id=` — read live config + draft + schemas for analysis (note: triggers `ensureThemeInstance` as a side-effect if the instance does not exist; this is idempotent but is a write)

Recommendation: expose these as LCIS `/api/theme-intelligence?store=X` with an internal fan-out to the three endpoints above. Cache the results for 60 s with a store-scoped cache key.

### Tier 2 — Write Operations (apply, publish, configure)

These must be user-approved before LCIS executes them. They are reversible but create audit records and may affect the live storefront.

- `save_draft` → `PUT /themes/:slug/editor/draft` — safe to apply with approval; fully reversible via discard-draft
- `publish_draft` → `POST /themes/:slug/publish` — affects live storefront; requires explicit user confirmation; creates immutable release
- `rollback_theme` → `POST /themes/:slug/releases/:releaseId/rollback` — restores a previous state; should show diff of what changes before executing
- `generate_preview_url` → `POST /themes/:slug/preview-session` — low-risk; creates a time-limited signed URL
- `install_theme` → `POST /themes/:slug/install` — affects live storefront; requires explicit user confirmation; irreversible without a subsequent install or rollback

Implementation pattern: LCIS should present a "proposed change" with diff before calling any Tier 2 write. The write call should include `publish_message` or `rollback_message` with an LCIS-generated description so the audit trail is human-readable.

### Tier 3 — Autonomous Operations (detect degradation, auto-rollback)

These are high-risk operations that LCIS should surface as recommendations only, never execute without an explicit human-in-the-loop gate.

- **Auto-rollback on storefront error spike**: LCIS can detect a pattern (storefront 5xx rate increase after a recent publish) and recommend a rollback to the previous release, presenting the release metadata and the `POST /themes/:slug/releases/:releaseId/rollback` payload. The merchant clicks "Roll back now" which executes it.
- **Draft staleness alert**: LCIS can inspect `theme_editor_drafts.auto_saved_at` (returned in `loadEditor`) and alert if a draft has not been published within N days, recommending either publish or discard.
- **Schema drift detection**: LCIS can compare the `schema_manifest_version` in the latest release against the current theme's schema registry version and alert if the installed config was published against an older schema that may have incompatible section types.
- **Theme instance health**: LCIS can verify `theme_instances.instance_status = 'active'` matches `sites.theme_id` and alert on divergence without any write operation.

Implementation pattern: LCIS `/api/theme-intelligence?store=X` should return a `recommendations[]` array with `{ type, severity, title, description, action_endpoint, action_payload }`. The UI renders each recommendation with a single-click "Apply" that calls the action endpoint. No action should fire without user click.

### Data Model for LCIS Theme Intelligence

```
/api/theme-intelligence?store=X
  active_theme: { slug, name, release_version, published_at, is_current }
  installed_themes: [{ slug, name, installed_at, is_active }]
  draft_state: { exists, template_key, version, auto_saved_at }
  release_history: [{ id, version, status, message, published_at, rollback_of }]
  schema_info: { manifest_version, source, section_count, block_count }
  health: { instance_status, schema_drift, draft_age_hours, last_publish_age_hours }
  recommendations: [{ type, severity, title, description, action_endpoint, action_payload }]
```

This can be assembled from three existing gateway calls:
1. `GET /themes?store_id=X` (active + installed state)
2. `GET /themes/:slug/editor?store_id=X` (draft + schema + release)
3. `GET /themes/:slug/releases?store_id=X` (full history)

No new gateway endpoints are required for read-only intelligence. The write tooling (`save_draft`, `publish_draft`, `rollback`) maps directly to existing authenticated gateway endpoints.
