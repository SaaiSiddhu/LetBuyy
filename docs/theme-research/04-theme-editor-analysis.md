# Theme Editor Deep Analysis

## Overview

The theme editor is a full-screen WYSIWYG (what-you-see-is-what-you-get) tool inside `merchant-control-plane` that lets merchants customize the look, content, and layout of their storefront without writing code. From it, merchants can:

- Browse and install themes from the catalog or upload a portable JSON bundle
- Open the editor for any installed theme, selecting which page template to edit (Home, Product, Collection, Cart, Blog, custom)
- Modify section-level settings (heading text, colors, images, toggles) and block-level settings within each section
- Reorder, add, hide, or remove sections in the page template
- Edit global theme settings (palette, fonts, layout) that apply across all pages
- See a live storefront preview inside an iframe, scoped to their subdomain
- Save work-in-progress as a versioned draft with undo/redo (up to 50 states)
- Publish the draft to make it live on the storefront (creating an immutable release snapshot)
- Rollback to any prior release
- Publish or unpublish the storefront itself (password-protect)

---

## Architecture

### Editor Entry Point

The themes section lives under `apps/merchant-control-plane/src/app/[store]/online-store/themes/`.

**Themes list page** (`page.tsx`) is the first screen:
- Fetches `GET /api/themes?store_name=<store>` on mount, receiving the full theme catalog, the currently active theme slug, store status (published/draft), and the store's internal UUID.
- Renders the "current theme" hero card (with a static CSS color-palette artwork preview, not a live iframe).
- Has "Edit theme" button that navigates to `/<store>/online-store/themes/<slug>/editor`.
- Supports installing themes by slug or uploading a portable JSON bundle (`POST /api/themes/install`), and toggling storefront publish status (`POST /api/themes/publish`).

**Editor page** (`[themeId]/editor/page.tsx`) is a `'use client'` Next.js component wrapped in `<Suspense>`. It contains `ThemeEditorInner`, the full editor shell (~1900 lines), plus sub-components `SectionTree`, `ThemeSettingsTree`, `VersionTree`, `PropertyPanel`, and `EditorLoading`.

Routing pattern:
```
/<store>/online-store/themes → themes list page
/<store>/online-store/themes/<themeId>/editor → full-screen editor
```

### CenterPanel — The Editor Shell

`apps/merchant-control-plane/src/components/theme-editor/CenterPanel.tsx`

CenterPanel is the center column of the editor. It renders a simulated browser chrome (dots, URL bar, lock icon) wrapping a live `<iframe>`. Its state and behavior:

**iframe URL construction:**
```
<storefrontBaseUrl>/preview?subdomain=<storeName>&editor=1&viewport=<desktop|tablet|mobile>&theme_preview_token=<token>
```

The `/preview` route on `storefront-runtime` is the special editor-preview endpoint (not the public storefront route). The URL is recomputed whenever `previewToken`, `viewport`, or `storeName` changes; Next.js re-mounts the iframe when the key (`key={previewUrl}`) changes.

**Cross-origin postMessage protocol:**

The merchant control plane (origin: `merchant.letbuyy.com` or local) and the storefront runtime (origin: `storefront-runtime` base URL) communicate over `postMessage` with two message types:

| Direction | Type | Payload |
|---|---|---|
| Editor → Preview | `LETBUYY_THEME_EDITOR_SELECTION` | `{ selectedSectionId: string \| null }` |
| Preview → Editor | `letbuyy:theme-editor:section-select` | `{ sectionId: string, sectionType: string, rendererKey: string }` |

The editor gates outbound messages on `iframeLoadedRef.current = true` (set in `onLoad`) to avoid posting to an `about:blank` frame still on the parent origin, which would trigger a cross-origin error.

**Props passed from parent:**
- `previewToken` — the live session token used in the iframe URL
- `previewError` / `isPreviewRefreshing` — shown as status overlays on the preview canvas
- `selectedSectionId` — highlight communicated to preview
- `viewport` — controls the CSS class used to size the iframe (desktop/tablet/mobile)

### SchemaFormRenderer

`apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx`

A pure React form renderer driven by a `Record<string, SchemaField>` schema. It maps each key to the appropriate field widget. Supported schema field types:

| `type` value | Widget |
|---|---|
| `text` | `<Input type="text">` |
| `textarea` / `richtext` | `<textarea>` |
| `color` | Native `<input type="color">` + hex text input side-by-side |
| `image` | URL text input + file upload button → `POST /api/stores/<store>/upload` |
| `select` | `<select>` dropdown |
| `toggle` | Custom toggle button with `role="switch"` |
| `range` | `<input type="range">` + numeric readout |
| `url` | `<Input type="url">` |
| `number` | `<Input type="number">` |
| `radio` | Segmented button group |
| unknown / fallback | `<Input type="text">` |

In the editor page, `SchemaFormRenderer` is used in three contexts:
1. **Section settings** — `selectedSectionSchema.settings_schema` as the schema, `selectedSection.settings` as the values
2. **Block settings** — `selectedBlockSchema.fields` as the schema, `selectedBlock.settings` as the values
3. **Theme settings** — `selectedThemeGroup.fields` as the schema, `editorState.themeSettings` as the values

Schema normalization (aliasing `checkbox` → `toggle`, `font` → `select`, stripping unknown types to `text`) happens in `normalizeField()` inside `editor/page.tsx`, not in `SchemaFormRenderer` itself.

---

## API Routes — Full Map

All merchant-control-plane routes proxy through to the API gateway (`createMerchantApiClient()`). All routes resolve and verify store ownership via `resolveOwnedStoreId` before forwarding.

### `GET /api/themes`

**Purpose:** Fetch the theme catalog plus the store's current theme, status, and internal ID.

**Auth:** Merchant session (resolves `storeId` from `store_name` query param via `resolveOwnedStoreId`).

**DB operations (via gateway → ThemeExecutionAdapter):**
- `db.from('themes').select('*').eq('is_active', true)` — full catalog
- `db.from('store_themes').select('theme_id, is_active').eq('store_id', storeId)` — installed themes
- `db.from('sites').select(...)` — store status and `theme_id`

**Response:** `{ themes: ThemeRecord[], currentTheme: ThemeRecord | null, storeStatus: string, storeId: string }`

---

### `GET /api/themes/[themeId]/editor`

**Purpose:** Load the full editor state for a theme+store+template combination.

**Auth:** Merchant session. `store_name` query param required. `template` query param (default `index`).

**DB operations (via ThemeExecutionAdapter.loadEditor):**
- `db.from('sites').select(...).eq('id', storeId)` — verify store ownership
- `db.from('themes').select('*').eq('slug', themeId).eq('is_active', true)` — theme record
- `db.from('theme_editor_drafts').select('id, draft_config, template_key, version, auto_saved_at').eq('store_id', storeId).eq('theme_id', themeId).eq('template_key', templateKey)` — current draft
- `db.from('theme_releases').select('id, release_version, published_at').eq('store_id', storeId).eq('theme_id', themeId).eq('is_current', true)` — current published release
- `SchemaRegistryExecutionAdapter.resolveThemeRuntime(theme)` — section/block/settings schemas

**Response:**
```ts
{
  store: { id, name, subdomain, status },
  theme: { id, slug, name, renderer_key, theme_package_id, schema_manifest_version, schema_source },
  templateKey: string,
  templates: TemplateOption[],
  templateConfig: JsonRecord,       // live config (or draft config if draft exists)
  draftConfig: JsonRecord | null,   // null if no draft
  draftSavedAt: string | null,
  release: { version: number, published_at: string } | null,
  sectionSchemas: Record<string, SectionSchema>,
  themeSettingsSchema: ThemeSettingsSchema,
  version: number,
}
```

---

### `PUT /api/themes/[themeId]/editor`

**Purpose:** Publish the last saved draft to the live storefront (creates an immutable release).

**Auth:** Merchant session. `store_name` query param required.

**Body:** `{ templateKey?, templateConfig?, baseVersion?, publishMessage? }`

**DB operations (via ThemeExecutionAdapter.publish):**
- Verifies store ownership
- Loads draft record
- Validates template config against schema runtime
- `db.rpc('publish_theme_release', { ... })` — the canonical publish RPC (falls back to direct `theme_releases` insert + `sites` update if the RPC is missing)
- After publish: `db.from('theme_editor_drafts').delete()` — deletes the draft
- `bumpStorefrontCacheVersion` + `purgeStorefrontCache` — Cloudflare cache purge

**Response:** `{ success: true, savedAt, templateKey, release: { release_id, release_version, published_at } }`

---

### `POST /api/themes/[themeId]/editor/draft`

**Purpose:** Auto-save the current editor state as a versioned draft (called every ~900ms when dirty).

**Auth:** Merchant session. `store_name` query param required.

**Body:** `{ draftConfig: JsonRecord, templateKey?: string, baseVersion?: number }`

**DB operations (via ThemeExecutionAdapter.saveDraft):**
- `db.from('theme_editor_drafts').upsert({ store_id, theme_id, template_key, draft_config, version, auto_saved_at }, { onConflict: 'store_id,theme_id,template_key' })` — upsert draft record
- `db.from('theme_instance_drafts').upsert(...)` — save instance-scoped draft snapshot
- `db.from('theme_draft_patches').insert(...)` — append patch record
- Domain event: `theme.draft.saved` + audit event

Conflict detection: if `baseVersion` is supplied and `existingVersion > baseVersion`, throws `ConflictError('Theme draft has changed in another session')`.

**Response:** `{ success: true, savedAt: string, version: number, templateKey: string }`

---

### `DELETE /api/themes/[themeId]/editor/draft`

**Purpose:** Discard the saved draft (user clicks "Discard").

**Auth:** Merchant session. `store_name` query param required.

**DB operations:**
- `db.from('theme_editor_drafts').delete().eq('store_id', storeId).eq('theme_id', themeId).eq('template_key', templateKey)`
- Domain event: `theme.draft.discarded`

**Response:** `{ success: true, templateKey }`

---

### `POST /api/themes/[themeId]/preview-session`

**Purpose:** Create a short-lived preview token that the storefront can use to load the draft config.

**Auth:** Merchant session.

**Body:** `{ store_name: string, ttl_seconds?: number (default 900), templateKey?: string }`

**DB operations (via ThemeExecutionAdapter.createPreviewSession):**
- Loads draft record (must exist — returns 404 if no draft)
- `crypto.randomUUID()` × 2 → raw token; SHA-256 → `tokenHash`
- `db.from('theme_preview_sessions').insert({ store_id, theme_id, draft_id, token_hash, expires_at, created_by })` — stores hash, never the plaintext token
- Audit event: `theme.preview_session.create`

**Response:** `{ success: true, data: { preview_session_id, preview_token, expires_at, draft_version, template_key } }`

The raw `preview_token` is returned once and only once — the DB stores only the SHA-256 hash.

---

### `GET /api/themes/[themeId]/releases`

**Purpose:** List the immutable release history for a theme+store.

**Auth:** Merchant session. `store_name` query param required.

**DB operations:**
- `db.from('theme_releases').select('id, theme_id, release_version, release_status, is_current, publish_message, published_at, ...').eq('store_id', storeId).eq('theme_id', themeId).order('release_version', { ascending: false })`

**Response:** `{ success: true, data: ThemeReleaseRecord[] }`

---

### `POST /api/themes/[themeId]/releases/[releaseId]/rollback`

**Purpose:** Restore a prior published snapshot as a new current release.

**Auth:** Merchant session.

**Body:** `{ store_name: string, make_store_live?: boolean (default true), rollback_message?: string }`

**DB operations (via ThemeExecutionAdapter.rollbackRelease):**
- Loads the target release: `db.from('theme_releases').select('..., release_config, template_snapshot').eq('id', releaseId)`
- Validates restored config against schema
- `db.rpc('publish_theme_release', { ..., rollback_of_release_id: releaseId })` — creates a new release referencing the old one
- `bumpStorefrontCacheVersion` + `purgeStorefrontCache`

**Response:** `{ success: true, data: { rollback: { release_id, release_version, published_at }, restored_release: { id, version, published_at }, theme } }`

---

### `GET /api/themes/[themeId]/sections`

**Purpose:** Return section schema catalog for a theme (section types, names, descriptions, block presence, settings count).

**Auth:** None required at the MCP level (no `resolveOwnedStoreId`).

**DB operations (via SchemaRegistryExecutionAdapter):**
- Reads from `theme_packages`, `theme_package_versions`, and related schema tables; falls back to static registry.

**Response:** `{ themeId, sections: AvailableSection[], schemas: Record<string, SectionSchema> }`

---

### `PUT /api/themes/[themeId]/sections/reorder`

**Purpose:** Persist a reordered section array into the draft. This is a convenience endpoint that reads, mutates, and re-saves the draft in one step.

**Auth:** Merchant session. `store_name` query param required.

**Body:** `{ sectionOrder: string[] }` — array of section IDs in new order.

**DB operations:**
- Calls `api.themes.editor(themeId, storeId)` to get the current template config
- Re-orders the `sections.template` array in-memory
- Calls `api.themes.saveDraft(themeId, { store_id, template_config: updatedConfig, client: 'admin-web' })`

**Response:** `{ success: true, sectionOrder: string[] }`

---

### `POST /api/themes/install`

**Purpose:** Install a theme by slug or upload+install a portable JSON bundle.

**Auth:** Merchant session (uses `storeId` from body, not `resolveOwnedStoreId`).

**Body:** `{ storeId: string, themeSlug?: string } | { storeId: string, bundle: Record<string, unknown> }`

**DB operations (via ThemeExecutionAdapter.installTheme):**
- Premium check: `db.from('theme_purchases').select('id').eq('user_id', userId).eq('theme_id', themeId).eq('status', 'completed')`
- `db.from('store_themes').update({ is_active: false }).eq('store_id', storeId)` — deactivate current
- `db.from('store_themes').upsert({ store_id, theme_id, is_active: true, ... }, { onConflict: 'store_id,theme_id' })`
- Creates theme instance record in `theme_instances`
- `db.rpc('publish_theme_release', { ... })` — immediate release on install
- Domain event: `theme.installed`

**Response:** `{ success: true, theme: { name, slug }, uploaded?: UploadRecord }`

---

### `POST /api/themes/publish`

**Purpose:** Toggle storefront visibility (publish or unpublish the store, not the theme).

**Auth:** Merchant session (uses `storeId` from body directly).

**Body:** `{ storeId: string, action: 'publish' | 'unpublish' }`

**DB operations:**
- `publish`: `api.stores.publish(storeId)` → sets `sites.status = 'published'`
- `unpublish`: `api.stores.update(storeId, { status: 'draft' })`

**Response:** `{ success: true, status: string }`

---

## Data Flow Diagrams

### Load Flow

```
Merchant opens /<store>/online-store/themes/<themeId>/editor
  │
  ├─ parallel fetch:
  │    ├─ GET /api/themes/<themeId>/sections → section catalog + schemas
  │    └─ GET /api/themes/<themeId>/editor?store_name=<store>&template=index
  │         → gateway → ThemeExecutionAdapter.loadEditor()
  │              ├─ sites (verify ownership)
  │              ├─ themes (get theme record)
  │              ├─ theme_editor_drafts (load draft if exists)
  │              ├─ theme_releases (current published release)
  │              └─ schema registry → section/block/settings schemas
  │
  ├─ normalizeEditorState() → EditorState { themeSettings, sections: { header, footer, template[] } }
  │
  ├─ setPreviewDevice('desktop'), setSelection(firstSection)
  │
  └─ syncPreviewDraft() → POST /api/themes/<themeId>/editor/draft (save initial)
                         → POST /api/themes/<themeId>/preview-session (get token)
                         → setPreviewToken(token)
                         → CenterPanel renders iframe with ?theme_preview_token=<token>
                              → storefront-runtime /preview page loads
                              → resolves token hash → loads draft config from DB
                              → renders storefront with draft theme
```

### Save/Draft Flow

```
Merchant changes a setting (e.g. hero heading text)
  │
  ├─ onChange fires → applyChange() → setEditorState(next) + setIsDirty(true)
  │    history.past.push(previousState), history.future = []
  │
  └─ useEffect watches [isDirty] → debounce 900ms → syncPreviewDraft()
       │
       ├─ buildDraftConfig(baseConfig, themeId, editorState, selectedTemplateKey)
       │    → portable JSON: themeSettings, sections as block_order maps, template key
       │
       ├─ POST /api/themes/<themeId>/editor/draft?store_name=<store>&template=<key>
       │    body: { draftConfig, templateKey, baseVersion }
       │    → gateway → saveDraft() → theme_editor_drafts UPSERT (version bump)
       │    response: { success, savedAt, version }
       │
       └─ POST /api/themes/<themeId>/preview-session
            body: { store_name, ttl_seconds: 900, templateKey }
            → gateway → createPreviewSession() → theme_preview_sessions INSERT
            response: { data: { preview_token } }
            → setPreviewToken(token) → CenterPanel remounts iframe (key changes)
```

**Manual save (Cmd+S or Save button):**
Same as draft auto-save (`saveDraft()`) but without the preview session step. Also resets the undo/redo history and marks the state clean. The SaveBar shows "Draft saved."

### Publish Flow

```
Merchant clicks Publish (requires dirty=false — must save first)
  │
  ├─ PUT /api/themes/<themeId>/editor?store_name=<store>&template=<key>
  │    body: { templateKey, templateConfig: buildDraftConfig(...), baseVersion }
  │    → gateway → ThemeExecutionAdapter.publish()
  │         ├─ loadEditorDraft() — verify version not stale
  │         ├─ validateTemplateConfig() — schema validation
  │         ├─ mergeThemeIdentity() — stamps themeId into config
  │         ├─ ensureThemeInstance() — upsert theme_instances
  │         ├─ publishReleaseSnapshot()
  │         │    → db.rpc('publish_theme_release', { p_store_id, p_theme_id, p_release_config, ... })
  │         │    → buildReleaseArtifacts() → release_manifest (engine, renderer_engine, liquid_ready flag)
  │         │    → sites.update({ theme_id, template_config, storefront_release_version, status='published' })
  │         ├─ finalizeInstanceRelease() — theme_instances.active_release_id = new release
  │         ├─ deleteDraft() — theme_editor_drafts.delete()
  │         └─ purgeThemeStorefrontCache() — Cloudflare cache bump + purge
  │
  └─ loadReleases() → GET /api/themes/<themeId>/releases → update VersionTree panel
```

### Rollback Flow

```
(VersionTree panel — not yet wired to UI action, but API is complete)

POST /api/themes/<themeId>/releases/<releaseId>/rollback
  body: { store_name, make_store_live: true, rollback_message? }
  → gateway → ThemeExecutionAdapter.rollbackRelease()
       ├─ load target release: theme_releases.select('release_config, template_snapshot')
       ├─ use template_snapshot if present, else release_config
       ├─ validateTemplateConfig()
       ├─ ensureThemeInstance()
       ├─ publishReleaseSnapshot({ rollbackOfReleaseId: releaseId })
       │    → new theme_releases row IS created (version = latest + 1)
       │    → new row carries rollback_of_release_id for lineage
       ├─ finalizeInstanceRelease()
       └─ purgeThemeStorefrontCache()
```

### Preview Session Flow

```
POST /api/themes/<themeId>/preview-session
  ─── merchant-control-plane ───────────────────────────────────────────────
  │   body: { store_name, ttl_seconds: 900, templateKey }
  │   → resolveOwnedStoreId(store_name) → storeId
  │   → api.themes.previewSession(themeId, { store_id, template_key, ttl_seconds })
  │
  ─── api-gateway (Cloudflare Worker) ────────────────────────────────────────
  │   → ThemeExecutionAdapter.createPreviewSession()
  │        ├─ verifyStoreOwner()
  │        ├─ loadEditorDraft() — must have an existing draft
  │        ├─ token = randomUUID() + "." + randomUUID()   (raw, shown once)
  │        ├─ tokenHash = SHA-256(token)
  │        └─ db.from('theme_preview_sessions').insert({
  │               store_id, theme_id, draft_id, token_hash,
  │               expires_at: now + ttl_seconds, created_by
  │             })
  │
  ─── storefront-runtime ─────────────────────────────────────────────────────
  │   CenterPanel iframe loads:
  │     /preview?subdomain=<store>&editor=1&theme_preview_token=<raw_token>
  │
  │   storefront-runtime/src/lib/theme-preview-server.ts:
  │     resolveThemePreviewToken(subdomain, token)
  │       → normalizeThemePreviewToken(token)  OR  read from cookie
  │
  │   storefront-runtime fetches bootstrap data:
  │     gateway verifies token hash:
  │       SHA-256(raw_token) == theme_preview_sessions.token_hash
  │       AND expires_at > now
  │       AND store_id == store
  │     → returns draft_config instead of published template_config
  │
  └─ storefront renders with draft config
       → each section wrapped in EditorPreviewSectionFrame (editorMode=true)
```

---

## Storefront Preview Integration

### `/preview` route and `editorMode`

The storefront-runtime has a dedicated `/preview` route (`apps/storefront-runtime/src/app/preview/page.tsx`) that the editor targets. It receives `?subdomain=<store>&editor=1&theme_preview_token=<token>&viewport=<device>`.

The `editor=1` query parameter sets `editorMode = true` in the render. This flag is threaded through the entire render pipeline:

- `apps/storefront-runtime/src/app/store/[subdomain]/page.tsx` — passes `editorMode={isEditorPreview}` to the layout/composition engine
- `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx` — passes `editorMode` to header and footer sections
- `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx` — the key integration point

### `EditorPreviewSectionFrame`

`apps/storefront-runtime/src/lib/theme-engine/editor-preview-section-frame.tsx`

When `editorMode=true`, the composition engine wraps every rendered section in `<EditorPreviewSectionFrame>` instead of a plain `<div>`. This React client component:

1. **Listens** for `letbuyy:theme-editor:section-selected` postMessages from the parent editor window. When the message's `sectionId` matches its own, it adds the `storefront-editor-section-frame--selected` CSS class (highlight ring).

2. **Notifies** the editor when the section is clicked or keyboard-activated by posting `letbuyy:theme-editor:section-select` with `{ sectionId, sectionType, rendererKey }` to `window.parent`. The editor receives this in `CenterPanel.handleMessage` and calls `onSelectSection(sectionId)`.

3. Renders a visible `<span>` label showing the `sectionType` in editor mode.

4. The target origin for outbound messages is derived from `document.referrer` URL's origin (falls back to `'*'`).

The storefront proxy (`apps/storefront-runtime/src/proxy.ts`) also handles the preview token as a cookie:
```ts
// proxy.ts line 152, 231
const themePreviewToken = normalizeThemePreviewToken(req.nextUrl.searchParams.get('theme_preview_token'));
// Sets a host-only cookie so subsequent navigation within the preview stays in draft mode
```

### Token Resolution

`apps/storefront-runtime/src/lib/theme-preview-server.ts` provides `resolveThemePreviewToken(subdomain, explicitToken)`:
1. Normalize the explicit token from the query string
2. If absent, check the preview cookie named `__lb_tp_<subdomain>`

This means a merchant can navigate between pages inside the preview iframe and retain the draft context as long as the token has not expired (900 seconds TTL).

---

## Theme Execution Adapter

`services/api-gateway/src/execution/theme-execution.adapter.ts`

The `ThemeExecutionAdapter` class is the authoritative DB layer for all theme operations in the gateway (Cloudflare Worker). Key responsibilities:

**Store ownership verification** (`verifyStoreOwner`): Queries `sites` table joining on `user_id` OR `custom_user_id`. Supports legacy schema without `deleted_at` column via retry.

**Schema resolution** (`SchemaRegistryExecutionAdapter.resolveThemeRuntime`): Resolves section schemas, block schemas, settings schema, renderer manifest, approved renderer keys, and theme package version IDs. This determines whether a theme is in the static registry or has a live `theme_packages` / `theme_package_versions` DB record.

**Draft management** (tables: `theme_editor_drafts`, `theme_instance_drafts`, `theme_draft_patches`):
- Legacy flat draft: one row per `(store_id, theme_id, template_key)` in `theme_editor_drafts`
- New instance draft: one row per `theme_instance_id` in `theme_instance_drafts`, with patch history in `theme_draft_patches`
- Both coexist; the adapter handles missing `template_key` column (pre-migration fallback)

**Release pipeline** (tables: `theme_releases`, `theme_instances`):
- Primary path: `db.rpc('publish_theme_release', { p_store_id, p_theme_id, p_release_config, p_published_by, p_make_store_live, ... })` — a `SECURITY DEFINER` RPC that atomically creates the release row and updates `sites.template_config`
- Fallback path (if the RPC is missing): direct `theme_releases.insert` + `sites.update` — used when the migration has not run yet
- After publish: `buildReleaseArtifacts()` stamps the release with `renderer_engine` (`'liquid'` if a `liquidBundle` is present, else `'json-contract'`), `liquid_ready` flag, cache tags, and approved renderer keys

**Conflict detection**: `isStaleThemeEditorBaseVersion(currentVersion, baseVersion)` — if the client's `baseVersion` is lower than the DB's current version, the save/publish is rejected with `ConflictError`.

**Cache invalidation**: After every publish or rollback, `purgeThemeStorefrontCache()` bumps the Cloudflare KV cache version and purges the storefront bootstrap cache keys for the store's subdomain, store_name, and custom_domain.

---

## Current Limitations

**What the editor can do today:**
- Edit all schema-declared section settings and block settings
- Add/remove/reorder/hide template sections (not header/footer — those are pinned)
- Edit global theme settings
- Save versioned drafts with conflict detection
- Preview in desktop/tablet/mobile viewports via live iframe
- Publish with a full immutable release record
- Roll back to a prior release (API complete, UI not wired in the VersionTree yet)
- AI hooks: synthetic copy generation, layout adjustments, block insertion (client-side only, no LLM call)

**What the editor cannot do today:**
- Block drag-and-drop reordering (only up/down arrow buttons)
- Section drag-and-drop (the `PUT /api/themes/[themeId]/sections/reorder` endpoint exists but is separate from the in-editor flow, which uses `moveSection()` on the client and saves via the draft API)
- Rich text / HTML editing inside richtext fields (rendered as `<textarea>`)
- Font picker (normalized to `select` with options from schema)
- Image asset browser (image fields accept URL text or upload; no asset library)
- Multi-page simultaneous edit (one template key at a time; switching warns to save first)
- Real-time collaboration (single user; version conflict returns 409)
- The rollback UI action (VersionTree renders release history but has no rollback button wired)
- Liquid template editing (no code editor surface)
- App blocks / app embeds (no UI; the schema supports `app_block` types in principle)

---

## Can Preview Become 100% Liquid?

### Current State

The preview iframe loads the storefront-runtime `/preview` route. In the composition engine (`composition-engine.tsx`), each section is rendered by `renderRegisteredSection()` — which dispatches to the React `renderer-registry`. When `editorMode=true`, every section is additionally wrapped in `EditorPreviewSectionFrame`.

The `LiquidRenderedHtml` path in `composition-engine.tsx` also exists: sections with a `liquid` renderer engine have their Liquid template compiled and the raw HTML injected via `dangerouslySetInnerHTML`, with React hydration islands for interactive parts. However, the `EditorPreviewSectionFrame` is currently only applied to the React path (`renderRegisteredSection` output). The Liquid path does not wrap sections in `EditorPreviewSectionFrame`.

From the release manifest builder (`buildReleaseArtifacts`), the `renderer_engine` is set to `'liquid'` only when a `liquidBundle` is present in the release config. The `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` canary flag (noted in memory) means most stores default to the React renderer. For the one Liquid-first theme (Urban Kicks), the Liquid path is active but editor mode section framing is not wired.

**Estimated split today:**
- React sections: ~100% of preview for all stores except Liquid-canary stores
- Liquid sections in preview with section selection: 0% (frame not applied to Liquid output)

### What Prevents Full Liquid Preview Today

1. **`EditorPreviewSectionFrame` is React-only.** The component uses `useState` for selection state and `useEffect` + `addEventListener` for postMessage. A pure Liquid template rendered as static HTML cannot contain this logic. To support it, a client-side JS script would need to inject the selection overlay and event listeners into each Liquid-rendered section's DOM element (using `data-section-id` attributes).

2. **Section framing not applied on the Liquid render path.** `composition-engine.tsx`'s `LiquidRenderedHtml` branch does not wrap output in `EditorPreviewSectionFrame`. The `data-letbuyy-editor-section-id` / `data-section-id` attributes exist in the `<div>` wrapper on the React path; they would need to be emitted by the Liquid template itself or injected server-side.

3. **Preview token resolution for Liquid rendering.** The storefront-runtime already resolves the preview token server-side and passes draft config into the render plan. This part works for both paths.

4. **Post-message origin security.** `EditorPreviewSectionFrame.getParentTargetOrigin()` derives target origin from `document.referrer`. A vanilla JS script doing the same would need the same derivation; this is achievable.

5. **Liquid template section boundaries.** Liquid templates render contiguous HTML; section boundaries must be explicitly delimited using Liquid tags that emit `data-section-id` attributes. This is a Liquid template authoring concern, not a blocker in principle.

### What Would Need to Change

1. **Client-side editor bridge script for Liquid sections.** A small `<script>` injected only in `editorMode=true` that:
   - Finds all `[data-section-id]` elements
   - Attaches click handlers that post `letbuyy:theme-editor:section-select`
   - Listens for `LETBUYY_THEME_EDITOR_SELECTION` / `letbuyy:theme-editor:section-selected` to apply highlight CSS
   - This replaces `EditorPreviewSectionFrame` for the Liquid path

2. **Liquid section templates must emit `data-section-id`.** Each Liquid section template needs a wrapper element: `<div data-section-id="{{ section.id }}" data-renderer-key="{{ section.renderer_key }}">`.

3. **`composition-engine.tsx` Liquid path must call the bridge script injection** (or the `/preview` page must inject it when `editorMode=true` and renderer is Liquid).

4. **`storefront-preview-bridge.tsx`** (`apps/storefront-runtime/src/app/preview/`) — this file already exists as a client component. It could be extended or replaced to cover the Liquid bridge case.

### Risk Assessment

| Concern | Risk | Mitigation |
|---|---|---|
| Section click selection in Liquid | Medium | Client-side JS bridge (small, well-scoped) |
| Preview token / draft config resolution | Low | Already works server-side for both paths |
| PostMessage cross-origin safety | Low | Same `document.referrer` derivation |
| Liquid template `data-section-id` discipline | Medium | Requires Liquid template authoring standards |
| Highlight CSS injection | Low | CSS class toggle via JS, same as React path |
| ART-17 freeze on new React-per-section | N/A | The editor shell itself (CenterPanel, SchemaFormRenderer) stays React permanently |

Full Liquid preview is achievable without changing the editor shell. The main work is a small client-side JS bridge + Liquid template discipline. The architectural risk is low because the token, draft config, and postMessage protocol are already correct; only the DOM event wiring for Liquid-rendered sections is missing.

---

## What Should Remain React Permanently

The following components have no Liquid migration opportunity and must stay React:

1. **`CenterPanel.tsx`** — The iframe manager. It is part of `merchant-control-plane`, not `storefront-runtime`. It runs in the admin app (a different origin, different port, different bundle). It has no Liquid context whatsoever.

2. **`SchemaFormRenderer.tsx`** — A form widget library. Forms require React state (`useState`, `useCallback`), controlled inputs, file upload via `fetch`, toast notifications, and `@letbuyy/ui` design-system components. None of these are renderable in Liquid. This is admin UI, not storefront content.

3. **`ThemeEditorInner` (editor page shell)** — The entire left sidebar (SectionTree, ThemeSettingsTree, VersionTree), the PropertyPanel, topbar with device toggle and publish/save buttons, undo/redo state machine, SaveBar, ConfirmDialogs. All are admin React UI.

4. **`EditorPreviewSectionFrame.tsx`** — Currently React. For the React render path this should stay React. For the Liquid render path it would be replaced by a vanilla JS equivalent (not a React component) to avoid hydrating Liquid-rendered HTML inside a React tree.

5. **`storefront-preview-bridge.tsx`** — Client-side bridge component for the `/preview` route. Should remain a React client component (or become a vanilla script) but is admin-adjacent infrastructure, not storefront content.

---

## Migration Opportunities

The following surfaces inside the editor workflow could become Liquid-native, given the appropriate infrastructure:

1. **Preview sections in storefront-runtime** — when `editorMode=true` and `renderer_engine='liquid'`, section HTML is already Liquid-rendered. Adding a client-side bridge script completes the migration for editor interaction. This is the highest-value migration.

2. **Theme settings schema rendering in preview** — global theme settings (colors, fonts) are already applied to CSS custom properties in both React and Liquid paths. No migration needed.

3. **Section data binding for preview** — the draft config's `themeSettings` and per-section `settings` are already passed into the Liquid render context via the storefront-runtime render plan. No migration needed.

4. **Release manifest `liquid_ready` flag** — `buildReleaseArtifacts()` already sets `liquid_ready: Boolean(liquidBundle) || rendererManifest.liquid_ready === true`. This flag could gate full Liquid preview mode in the editor automatically once the bridge script is in place.
