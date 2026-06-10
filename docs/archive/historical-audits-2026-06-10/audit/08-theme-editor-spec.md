# 08 — Theme Editor Specification (Phase 6)

Target: Shopify-level visual editor. Baseline reality (doc 03 V-18/V-19): a working but monolithic editor at `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` (2,067 lines) with schema forms, undo/redo, drafts, releases, device preview, iframe bridge (one-way). This spec defines the complete feature set, data, APIs, state, events, permissions — marking EXISTS / EXTEND / BUILD.

---

## 1. Feature Specification

| Feature | Status | Notes |
|---|---|---|
| Section list w/ groups (header/template/footer) | EXISTS | tree in page.tsx |
| Add/remove/toggle section | EXISTS | schema catalog driven |
| Reorder: drag-and-drop | **BUILD** | replace up/down buttons; dnd-kit; keyboard accessible; constraint: groups not draggable across roles |
| Nested blocks: add/remove/edit | EXISTS | `BlockEditor` inline |
| Nested blocks: drag reorder + cross-section move | BUILD | within `blocks_schema` `max_blocks` limits |
| Settings forms (11 field types) | EXISTS | `SchemaFormRenderer` |
| Resource pickers (product/collection/page/blog/menu/font) | BUILD | doc 07 §7; searchable modal hitting gateway list endpoints (EXIST) |
| Theme settings panel | EXISTS | extend to settings_schema groups (V-06) |
| Template switcher (index/product/collection/…) | **BUILD** | today a dead label; switches template JSON + preview route |
| Live preview iframe | EXISTS | storefront `/preview` + `?editor=1` |
| In-canvas select/hover → panel focus | **BUILD (other half)** | editor already posts `LETBUYY_THEME_EDITOR_SELECTION`; add storefront listener + overlay outlines + click capture in `EditorPreviewSectionFrame` (EXISTS) |
| Incremental canvas update (no full reload) | BUILD | `POST /preview-render` per dirty section (doc 06 §5); fallback full iframe refresh |
| Device preview 1440/820/390 | EXISTS | |
| Undo/redo 50 steps | EXISTS | upgrade to patch-based (below) |
| Autosave drafts | EXISTS | `POST /api/themes/[id]/editor/draft` |
| Draft discard | EXISTS | DELETE route |
| Publish | EXISTS | PUT → `themes.publish(make_store_live)` |
| Version history + rollback | EXISTS | releases list + rollback route |
| Release diff viewer | BUILD | settings/sections JSON diff between releases |
| Scheduled publish | BUILD | `theme_releases.scheduled_at` + gateway cron (cron handler EXISTS) |
| App blocks in editor (add `@app` block, configure) | BUILD | list installed apps' theme extensions (`app_extension_registrations` EXISTS) |
| App embeds toggle panel | BUILD | doc 10 §5 |
| Multi-user safety (draft locking / presence) | BUILD-lite | single-writer lock via `theme_instance_drafts.locked_by/locked_at`; full CRDT deferred (patch log table already exists) |
| Locale-aware text editing | LATER | locales/*.json exist; editor v2.1 |
| Code editor (edit liquid in browser) | LATER | post-CLI; not in this phase |

## 2. Database Design

Converge on the **instance-draft** family (kills V-20); `theme_editor_drafts` retired (doc 11 §4).

```
theme_instances            EXISTS  (per-store install; current_draft_id)
theme_instance_drafts      EXISTS  (working copy)  + ADD: locked_by uuid NULL, locked_at timestamptz,
                                                      base_release_id uuid (fork point), updated_by
theme_draft_patches        EXISTS  (append-only patch log; patch_sequence, server_revision)
theme_releases             EXISTS  (immutable snapshots; is_current; rollback_of_release_id)
                                   + ADD: scheduled_at timestamptz NULL, published_by uuid,
                                          release_notes text, diff_summary jsonb
theme_preview_sessions     EXISTS  → DROP legacy draft_id pointer after convergence
theme_assets               EXISTS  → wire (doc 07 §9)
```

Draft content model = full `templateConfig` JSON (current) **plus** patch log for audit/undo durability. Server is source of truth for `server_revision`; client sends `If-Match: revision` (optimistic concurrency — `version` int already on drafts).

## 3. API Design (gateway `/v1/themes`, BFF proxies keep current shape)

```
GET    /v1/themes/:instanceId/editor                 EXISTS (store, meta, templateConfig, draftConfig,
                                                     sectionSchemas, themeSettingsSchema, release)
POST   /v1/themes/:instanceId/draft                  EXISTS (autosave; + If-Match revision → 409 on conflict)
DELETE /v1/themes/:instanceId/draft                  EXISTS (discard)
POST   /v1/themes/:instanceId/draft/patches          BUILD (batched ops for patch log + presence heartbeat)
POST   /v1/themes/:instanceId/preview-render         BUILD (sectionId(s) → HTML fragments; uses draft + data_requirements)
POST   /v1/themes/:instanceId/publish                EXISTS via PUT editor → make_store_live (+ scheduled_at param BUILD)
GET    /v1/themes/:instanceId/releases               EXISTS
POST   /v1/themes/:instanceId/releases/:rid/rollback EXISTS
GET    /v1/themes/:instanceId/releases/:a/diff/:b    BUILD
GET    /v1/themes/section-schemas?engine=liquid      EXISTS (from theme-registry / bundle schemas)
GET    /v1/storefront/resources?type=product&q=      EXIST (reuse products/collections/pages/blog/menus list endpoints)
POST   /v1/themes/:instanceId/preview-session        EXISTS (token, TTL)
```

All routes behind `authMiddleware` + `storeContext()` ownership (EXISTS); publish/rollback additionally require role below.

## 4. State Management Design (client)

Replace monolith state with a single store (Zustand or equivalent already-approved lib; no Redux dependency added):

```
EditorState {
  doc: TemplateConfig            // normalized: sectionsById, orderByTemplate, groups, settings
  selection: {sectionId?, blockId?}
  dirty: Set<sectionId|'settings'>
  history: PatchStack{past[], future[]}   // command-pattern patches (move/add/update/remove)
  sync: {revision, status: saved|saving|conflict, lastSavedAt}
  preview: {device, templateKey, mode: interactive|select}
  catalog: {sectionSchemas, settingsSchema, appExtensions}
}
```

- Every mutation = `Patch {op, path, before, after}` → applied locally (optimistic) → debounced 800ms into draft POST + patch batch. Undo/redo replays patches (replaces 50-snapshot array — memory + enables patch log parity).
- Conflict (409): banner "Draft changed elsewhere" → reload-merge (server wins, local unsent patches replayed where paths untouched).
- Canvas sync: dirty sections → `preview-render` → `postMessage REPLACE_SECTION {id, html}`; storefront listener swaps `[data-section-id]` innerHTML and re-runs island hydration for that subtree.

## 5. Event Design

postMessage protocol (namespace `LETBUYY_THEME_EDITOR_*`, origin-checked both ways):

| Direction | Event | Payload |
|---|---|---|
| editor→canvas | `SELECTION` (EXISTS) | sectionId, blockId |
| editor→canvas | `REPLACE_SECTION` / `REORDER` / `SET_DEVICE` / `SET_TEMPLATE` | BUILD |
| canvas→editor | `CANVAS_READY`, `SECTION_CLICKED`, `SECTION_HOVERED`, `NAVIGATE_REQUEST` (link clicks → editor decides template switch) | BUILD |

Domain events (existing envelope `RuntimeEventEnvelope` via outbox — topics for webhooks doc 10): `theme.draft.saved`, `theme.published` (EXISTS as notification mapping `theme.purchased`/`app.installed` pattern in notification-core — add these), `theme.rollback`, `theme.schedule.set`. Telemetry: editor session length, publishes, undo depth → analytics queue.

## 6. Permission Design

Roles exist (`auth-core`: `LetbuyyPredefinedRole = Administrator|Merchandiser|Support|Partner|Ops-Reviewer`; `PermissionAction`). Map:

| Action | Administrator | Merchandiser | Support | Partner (app dev) |
|---|---|---|---|---|
| Open editor / edit draft | ✓ | ✓ | view-only | own-extension preview only |
| Publish / schedule | ✓ | ✗ (configurable grant `theme.publish`) | ✗ | ✗ |
| Rollback | ✓ | ✗ | ✗ | ✗ |
| Install/remove themes | ✓ | ✗ | ✗ | ✗ |
| Toggle app embeds | ✓ | ✓ | ✗ | ✗ |

Enforced gateway-side (`requireStoreOwner`/role middleware EXIST); UI hides per capability list returned by `GET /editor` payload (extend response with `permissions[]`).

## 7. Non-Functional Requirements

Editor TTI ≤ 3s on 4G; section form keystroke→canvas ≤ 300ms (preview-render path); autosave ≤ 2s after idle; zero data loss on tab close (beforeunload flush + draft restore banner); a11y: full keyboard nav incl. drag alternative (existing up/down kept as a11y path), WCAG AA on panels; works on 1280px+ (mobile editing deferred — Flutter merchant-app has its own editor screen `SectionEditorScreen` which should consume these same APIs).

## 8. Decomposition Plan (kills V-18)

Split `page.tsx` →
```
editor/
├── page.tsx                      (≤150 lines: load, providers)
├── state/{store.ts, patches.ts, sync.ts}
├── panels/{SectionsPanel, SettingsPanel, VersionsPanel, AppsPanel}.tsx
├── canvas/{CanvasFrame.tsx, bridge.ts}
├── fields/  (SchemaFormRenderer split per field type + pickers)
└── modals/{AddSection, ResourcePicker, PublishDialog, DiffViewer}.tsx
```
Delete the 8 orphaned `src/components/theme-editor/*` components first (doc 05 D1) so the new tree starts clean; `SchemaFormRenderer` migrates into `fields/`.
