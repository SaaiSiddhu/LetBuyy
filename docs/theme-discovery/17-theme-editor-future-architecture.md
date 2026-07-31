# Theme Editor Future Architecture

## 1. Current Editor Capabilities (Evidence-Based)

Verified from `CenterPanel.tsx`, `SchemaFormRenderer.tsx`, the draft/sections API routes, and prior research in `docs/theme-research/04-theme-editor-analysis.md`:

**Section management**
- Add new sections from the schema catalog (`GET /api/themes/[themeId]/sections`)
- Remove template sections (header/footer are pinned and cannot be removed)
- Reorder template sections via `PUT /api/themes/[themeId]/sections/reorder` — reads current draft, reorders the `sections.template` array in memory, then re-saves; client also uses up/down arrow buttons directly
- Hide/show individual sections

**Settings editing**
- Section-level settings rendered by `SchemaFormRenderer` from `selectedSectionSchema.settings_schema`
- Block-level settings rendered from `selectedBlockSchema.fields`
- Global theme settings rendered from `selectedThemeGroup.fields` and stored in `editorState.themeSettings`
- All 10 field types supported: `text`, `textarea`/`richtext`, `color` (native picker + hex text), `image` (URL + file upload to `/api/stores/<store>/upload`), `select`, `toggle`, `range`, `url`, `number`, `radio`; unknown types fall back to `text`

**Preview**
- Live iframe at `<storefrontBaseUrl>/preview?subdomain=<store>&editor=1&viewport=<device>&theme_preview_token=<token>`
- Desktop / tablet / mobile viewport sizing via CSS class on the iframe wrapper
- Simulated browser chrome (dots, URL bar with lock icon)
- Section selection synchronized bidirectionally over `postMessage`: editor → preview (`LETBUYY_THEME_EDITOR_SELECTION`), preview → editor (`letbuyy:theme-editor:section-select`)
- `iframeLoadedRef` guard prevents posting to an `about:blank` frame still on the parent origin
- Preview token short-lived (900 s TTL), stored as SHA-256 hash only; draft config flows server-side

**Draft and versioning**
- Auto-save every ~900 ms when dirty (debounce in `editor/page.tsx`, not in `CenterPanel`)
- `POST /api/themes/[themeId]/editor/draft` upserts to `theme_editor_drafts` with version bump; `mergeLiquidDraftConfig` passes optional `liquidBundle` / `liquidRenderingCanary` fields through untouched
- Conflict detection: `baseVersion` checked against DB version; 409 returned if stale
- Up to 50 undo/redo states maintained in memory (history arrays in editor page)
- Manual save (Cmd+S or Save button) resets history and marks state clean
- Publish via `PUT /api/themes/[themeId]/editor` calls `publish_theme_release` RPC, then deletes draft, purges Cloudflare cache
- Rollback: API complete (`POST /api/themes/[themeId]/releases/[releaseId]/rollback`), creates a new `theme_releases` row carrying `rollback_of_release_id`; VersionTree in the UI renders release history but the rollback button is not yet wired

**Storefront publish**
- Toggle store visibility (`POST /api/themes/publish`) sets `sites.status`

---

## 2. Current Editor Limitations

Evidence from code, not assumptions:

| Gap | Evidence |
|-----|----------|
| No drag-and-drop section/block reorder | Reorder endpoint and client `moveSection()` exist but use index arithmetic, not drag events |
| `richtext` rendered as `<textarea>` | `SchemaFormRenderer` line 59–68: `case 'textarea': case 'richtext': return <TextareaInput .../>` — no WYSIWYG/HTML editor |
| Font picker reduced to `select` | `normalizeField()` in `editor/page.tsx` aliases `font` → `select`; options come from schema, no font-preview rendering |
| No image asset library | `ImageInput` accepts URL text or file upload; no browsing of previously uploaded assets |
| Single-template editing | One `templateKey` at a time; UI warns to save before switching template |
| No real-time collaboration | Single-user; 409 Conflict returned on version mismatch |
| Rollback not wired in UI | `VersionTree` panel renders history; no rollback button calls the API |
| No Liquid template code editor | No code surface; `liquid_ready` flag governs renderer path but is set at publish time |
| No app blocks / app embeds UI | Schema type `app_block` exists in principle; no UI section to add app blocks |
| No AI integration (backend) | Grep over all theme-editor `*.tsx` files returns zero hits for `AI`, `ai_`, `generate`, `suggest`, `assistant` — any AI hooks referenced in prior notes are client-only stubs with no LLM call |
| Preset system absent | No concept of named style presets; all settings are merchant overrides with no "default" baseline except schema `default` values |
| No named release labels | `theme_releases` has `publish_message` (free text) but no structured `label` or `tag` field |
| No change attribution (human vs AI) | `created_by` on `theme_preview_sessions`; release records do not distinguish human vs automated edits |

---

## 3. Adaptive Theme Editor Requirements

### How would the editor change for a preset system?

A preset is a named snapshot of `themeSettings` values (color palette, typography scale, spacing) bundled with the theme. When a merchant applies a preset:

1. **Editor state merge:** The preset's `themeSettings` values are written into `editorState.themeSettings` in `ThemeEditorInner`. The editor immediately marks `isDirty = true`, triggering the 900 ms auto-save debounce. The draft API (`POST .../editor/draft`) stores the merged config; no new API endpoint is needed.

2. **Showing "preset defaults" vs "merchant overrides":** The schema's `default` value on each `SchemaField` is already present and used as the fallback in `SchemaFormRenderer` (`value={values[key] ?? field.default ?? ''}`). A preset layer would sit between `field.default` (theme author default) and the merchant's explicit override. The `draftConfig` would carry a `presetId` key alongside `themeSettings`; `SchemaFormRenderer` would need a `presetValue` prop per field and an indicator dot/badge when `values[key] !== presetValue[key]`.

3. **Reset a section to its preset default:** A "Reset to preset" button per field or per section group would call `onChange(key, presetValues[key])` for each affected key, marking the state dirty. No new API surface is needed — it is a client-side state mutation feeding the existing draft path.

4. **Multiple presets across templates:** Because drafts are scoped to `(store_id, theme_id, template_key)`, each template can independently track a `presetId` in its `draftConfig`. The editor's template-switcher would load the preset badge for each template independently. The `mergeLiquidDraftConfig` helper in `draft/route.ts` already passes extra top-level keys through; adding `presetId` to the draft body requires no route change.

### Visual Design System

**Controls present today (from `SchemaFormRenderer`):**
- `color` — native `<input type="color">` + hex text input side by side (`ColorInput`, line 199–220)
- `select` — plain HTML `<select>` with string options (used for font family aliases after normalization)
- `range` — slider with numeric readout and optional `unit` suffix
- `toggle` — custom accessible toggle button
- `text` / `url` / `number` — standard text inputs

**Controls missing for a full design system editor:**
- Font preview: `select` options are raw strings (e.g., `"sans"`, `"serif"`, `"inter"`); no rendered preview of typefaces
- Color palette panel: colors are edited one-by-one per field; no global swatch grid showing all palette tokens simultaneously
- Typography scale panel: no unified panel showing heading / body / label sizes together
- Spacing / radius scale: `range` exists for individual values but no coordinated spacing scale editor
- CSS variable token mapping: `--lb-*` tokens are the platform design system standard; the editor has no way to map a section color field to a token (it always writes a literal hex value)
- Gradient / shadow pickers: no composite fields beyond flat color
- Responsive breakpoint preview for typography: no per-viewport font-size controls

**How a "design tokens" panel would work:**

A top-level `ThemeDesignTokensPanel` component would be added to the left sidebar alongside the existing `ThemeSettingsTree`. It would consume a `designTokensSchema` (a new top-level key in `themeSettingsSchema`) that groups token fields into named groups: `Colors`, `Typography`, `Spacing`, `Borders`. Each group renders a specialized widget (color swatch grid, type scale table, spacing ruler) rather than the generic `SchemaFormRenderer` field-by-field list. Mutations still call `onChange(tokenKey, value)` which feeds the existing `applyChange()` → draft path. The storefront-runtime already consumes `themeSettings` as CSS custom properties; no new API surface is needed, only new schema groups and panel UI.

### AI-Assisted Editing

**Editor actions suitable for AI automation:**
- Copy generation: given a section type (`hero`, `testimonials`, `product_feature`) and store metadata (name, category, tone), generate `heading`, `subheading`, `cta_text` field values
- Layout suggestion: given a product category (e.g., fashion vs. electronics), recommend a section order for the `index` template
- Image alt text: generate `alt` text for uploaded images based on filename + store context
- Color palette generation: given a brand primary color, generate a harmonious palette across all color token fields
- Section fill: for a newly added section, pre-fill all `text`/`textarea` fields with contextually appropriate placeholder copy

**How AI would interact with the editor:**

The cleanest integration is a sidebar `AISuggestionsPanel` that posts to a new MCP-callable route `POST /api/themes/[themeId]/editor/ai-suggest` with `{ sectionId, sectionType, fields, storeContext }`. The route calls the Anthropic API (claude-sonnet-4-6 or a smaller model for latency) and returns `{ suggestions: Record<string, string> }`. The panel displays each suggestion with a one-click "Apply" button that calls `onChange(key, value)` in the editor. No postMessage is needed — the AI panel is inside `merchant-control-plane`, co-located with the editor shell. The draft auto-save handles persistence after apply.

**Data the AI needs to see:**
- `sectionType` and `sectionSchema.settings_schema` (field names, types, labels, maxLengths)
- Current field values (to avoid overwriting deliberate merchant choices)
- `store.name`, `store.subdomain`, and ideally the store's product category from `sites` metadata
- Template context (which page template is being edited: `index`, `product`, `collection`)
- Brand tone/voice preference if set in merchant settings

---

## 4. Preview Architecture Analysis

### Current Preview Flow

1. Editor page calls `POST .../preview-session` → API gateway hashes a UUID token and inserts into `theme_preview_sessions` (stores `token_hash`, never the plaintext)
2. `CenterPanel` constructs the iframe URL: `/preview?subdomain=<store>&editor=1&viewport=<device>&theme_preview_token=<raw_token>`
3. `key={previewUrl}` causes React to fully remount the iframe whenever the URL changes (i.e., after every draft save + new session)
4. `iframeLoadedRef` is set to `false` on URL change and `true` in `handlePreviewLoad`; outbound postMessages are gated on this ref to prevent cross-origin errors against `about:blank`
5. `storefront-runtime /preview` resolves the raw token via SHA-256 comparison against `theme_preview_sessions.token_hash`, loads draft config from `theme_editor_drafts`, and renders with `editorMode=true`
6. Every React section is wrapped in `EditorPreviewSectionFrame` which:
   - Posts `letbuyy:theme-editor:section-select` upward on click (line 52–57 in `editor-preview-section-frame.tsx`)
   - Listens for `letbuyy:theme-editor:section-selected` to set `isSelected` state (line 40–48)
   - Derives target origin from `document.referrer` (line 21–28); falls back to `'*'`
7. `CenterPanel.handleMessage` (lines 73–83) receives `letbuyy:theme-editor:section-select` and calls `onSelectSection(sectionId)` in the parent editor

**Key message naming inconsistency:** `EditorPreviewSectionFrame` listens for `letbuyy:theme-editor:section-selected` (past tense) but `CenterPanel` sends `LETBUYY_THEME_EDITOR_SELECTION` (all caps, different name entirely). `CenterPanel` listens for `letbuyy:theme-editor:section-select` (present tense). The inbound message type name that `EditorPreviewSectionFrame` listens for (`section-selected`) is sent by `CenterPanel` as `LETBUYY_THEME_EDITOR_SELECTION` — these are two different strings. This is a latent bug: the selection highlight in the preview frame never receives the editor's selection broadcast. Investigate before adding to any preset or AI feature that depends on synchronized selection state.

### Liquid Preview Gap

From prior research (doc 04) and confirmed by source: `EditorPreviewSectionFrame` is a React client component. It uses `useState` (line 37), `useEffect` + `window.addEventListener` (lines 39–49), and React event handlers (lines 60–68). When `renderer_engine = 'liquid'` the composition engine injects raw Liquid-compiled HTML via `dangerouslySetInnerHTML`. This HTML cannot include a React component wrapper. Therefore:

- Liquid-rendered sections do NOT get wrapped in `EditorPreviewSectionFrame`
- Clicking a Liquid section in preview does NOT post `letbuyy:theme-editor:section-select`
- The editor cannot highlight a Liquid section from its sidebar selection
- The `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` canary flag means this only affects Urban Kicks (the single Liquid-canary theme) today

### Required Changes for Full Liquid Preview

Concrete steps, tied to specific files:

**Step 1 — Vanilla JS bridge script in `storefront-runtime`**

Create `apps/storefront-runtime/src/lib/theme-engine/liquid-editor-bridge.ts` (a plain TypeScript module, not a React component). It exports an IIFE-safe `initLiquidEditorBridge()` function that:
```
- querySelectorAll('[data-section-id]') to find all Liquid-rendered section roots
- Attaches click/keydown handlers on each that call window.parent?.postMessage(
    { type: 'letbuyy:theme-editor:section-select', sectionId, sectionType, rendererKey },
    getParentTargetOrigin()  // same logic as EditorPreviewSectionFrame lines 21-28
  )
- Adds a window.addEventListener('message', handler) that checks for
    type === 'letbuyy:theme-editor:section-selected'  (matching EditorPreviewSectionFrame's listener)
    and toggles CSS class 'storefront-editor-section-frame--selected' on the matching element
```

**Step 2 — `data-section-id` attributes in Liquid section templates**

Every Liquid section template must emit a root wrapper:
```liquid
<div data-section-id="{{ section.id }}"
     data-letbuyy-editor-section-type="{{ section.type }}"
     data-renderer-key="{{ section.renderer_key | default: 'liquid' }}">
  {{ section.html }}
</div>
```
This is a Liquid template authoring convention, not a code change in the runtime.

**Step 3 — Bridge script injection in `composition-engine.tsx` Liquid path**

In `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx`, the `LiquidRenderedHtml` branch currently does:
```tsx
<div dangerouslySetInnerHTML={{ __html: liquidHtml }} />
```
When `editorMode=true`, append the bridge script injection after the last Liquid section:
```tsx
{editorMode && <script dangerouslySetInnerHTML={{ __html: liquidEditorBridgeInlineScript }} />}
```
where `liquidEditorBridgeInlineScript` is the minified output of Step 1. This script fires after the DOM is painted and wires up all `[data-section-id]` elements found at that point.

**Step 4 — Fix the postMessage type name inconsistency (prerequisite)**

Before Step 3 is useful, resolve the naming mismatch documented above: `CenterPanel` sends `LETBUYY_THEME_EDITOR_SELECTION` but `EditorPreviewSectionFrame` listens for `letbuyy:theme-editor:section-selected`. Pick one canonical name per direction, update both files, and update the vanilla bridge in Step 1 to use the same names.

**Step 5 — `liquid_ready` flag gates automatic bridge activation**

`buildReleaseArtifacts()` in `services/api-gateway` already sets `liquid_ready: Boolean(liquidBundle) || rendererManifest.liquid_ready === true`. The `/preview` route can check this flag from the draft config's `release_manifest` and conditionally inject the bridge script without needing an extra query parameter.

**No changes required in `CenterPanel.tsx`:** the iframe URL construction, token passing, and inbound message handler already work correctly. The bridge script in the preview iframe handles the other end of the protocol.

---

## 5. Versioning Architecture

### Current State

Table: `theme_releases` (queried in `GET /api/themes/[themeId]/releases`)

Fields confirmed from `ThemeExecutionAdapter` and the releases route:
- `id` (uuid)
- `theme_id`
- `store_id`
- `release_version` (integer, monotonically increasing per store+theme)
- `release_status`
- `is_current` (boolean — only one row is current per store+theme)
- `publish_message` (free text, from `PUT /api/themes/[themeId]/editor` body)
- `published_at`
- `release_config` — full template snapshot (JSON)
- `template_snapshot` — used by rollback; if present, preferred over `release_config`
- `rollback_of_release_id` — FK back to the release this was rolled back from (provides lineage)

Rollback creates a NEW release row (version = latest + 1) that copies the old `release_config` and sets `rollback_of_release_id`. The historical record is never mutated.

### What's Missing

**Named versions / release labels**
`publish_message` is unstructured free text. There is no `label` (e.g., "Spring Sale 2026"), `tag` (e.g., `v2.1`, `pre-launch`), or structured metadata that the VersionTree UI could display as a meaningful title. Adding a `label` column to `theme_releases` and exposing it in the publish body (`PUT .../editor`) requires a migration and a body field addition. The MCP route and `ThemeExecutionAdapter.publish()` would pass it through to `db.rpc('publish_theme_release', { ..., p_label })`.

**Auto-snapshot before AI edits**
If AI suggestions are applied (see Section 3), the draft's `baseVersion` increments with each auto-save, but there is no way to identify "this version was the state before AI started editing". A `snapshot_reason` enum (`'manual'`, `'ai_edit'`, `'preset_apply'`, `'rollback'`) on `theme_draft_patches` (the patch history table already written by `saveDraft`) would provide this. No new table is needed; the `client` field in the draft save payload already accepts an arbitrary string (`'admin-web'` today).

**A/B test variant management**
No infrastructure exists for storing two simultaneous theme configs for the same template key. A/B testing would require a `theme_release_variants` table with `variant_id`, `release_id`, `allocation_percent`, and `config_snapshot`. The storefront-runtime would need to read the visitor's variant assignment from a cookie and select the appropriate config when resolving the preview (or live) render. This is greenfield work; no existing code supports it.

**Change attribution (human vs AI)**
The `created_by` field on `theme_preview_sessions` tracks who created the session (user UUID). `theme_draft_patches` records patches but has no `source` field distinguishing a merchant keystroke from an AI-applied suggestion. Adding `source: 'merchant' | 'ai' | 'preset' | 'import'` to the patch record and to `theme_releases.publish_source` would give the VersionTree full attribution. The draft save route (`draft/route.ts`) already accepts an arbitrary `client` field from the body; `'ai-suggest'` could be passed from the AI suggestions panel without any route change.

---

## 6. Recommended Editor Evolution (3 Phases)

### Phase 1 — Quick wins (2–4 weeks, changes to existing files only)

1. **Fix postMessage type name inconsistency** (`CenterPanel.tsx` line 78 + `editor-preview-section-frame.tsx` line 44). Pick canonical names; verify selection highlighting works end-to-end. Estimated: 1 day.

2. **Wire rollback button in VersionTree** — the API is complete (`POST .../releases/[releaseId]/rollback`); the UI only needs a `<Button>` in `VersionTree.tsx` calling the existing API client method. Estimated: 1 day.

3. **Persist `client` / `source` field in draft patches** — pass `source: 'merchant'` (or `'ai'` later) through the existing `client` body field to `ThemeExecutionAdapter.saveDraft()`; no DB migration required, the field already exists. Estimated: 0.5 days.

4. **`label` field on publish** — add `label?: string` to `PUT /api/themes/[themeId]/editor` body, pass to `db.rpc('publish_theme_release')` as `p_label`; requires one migration adding a `label` nullable column to `theme_releases`. Estimated: 1 day.

5. **Liquid editor bridge script (vanilla JS)** — implement Steps 1–4 from Section 4. Gated by `liquid_ready` flag; does not affect any React-rendered store. Estimated: 3–4 days.

### Phase 2 — Preset + Design System (4–8 weeks, new components and API fields)

1. **Preset schema and application** — add `presets` array to `ThemeSettingsSchema` (each preset: `{ id, label, themeSettings: Record }`). Add `presetId` tracking to `editorState`. Add "Apply Preset" dropdown in the theme settings panel. Client-only state mutation; draft API unchanged.

2. **"Override indicator" in `SchemaFormRenderer`** — add optional `presetValue` prop; render a small reset dot/button when `values[key] !== presetValue[key]`. No API change.

3. **Design tokens panel (`ThemeDesignTokensPanel`)** — new sidebar panel alongside `ThemeSettingsTree`. Consumes a `designTokensSchema` group from `themeSettingsSchema`. Color swatch grid widget (`ColourSwatchGrid`), type scale table widget (`TypeScaleTable`). Mutations feed existing `onChange` → draft path.

4. **Font preview in `SelectInput`** — when field type is `font` (before normalization), render a `<span style={{ fontFamily: opt }}>Aa</span>` preview next to each option. Requires preserving the pre-normalized `font` type through to `SchemaFormRenderer` instead of converting to `select` in `normalizeField()`.

5. **Image asset library sidebar** — new `AssetLibraryPanel` listing previously uploaded images for the store from `/api/stores/<store>/assets`. `ImageInput` gets a "Choose from library" button that opens the panel and calls `onChange(url)`. Requires a new `GET /api/stores/[store]/assets` route listing previously uploaded URLs.

### Phase 3 — AI-Collaborative Editor (long term, 8+ weeks)

1. **`AISuggestionsPanel` component** — right sidebar or collapsible footer panel. Shows pending AI suggestions per section with Accept/Reject per field. Accept calls `onChange(key, value)` → auto-save. Reject dismisses. History entry tagged `source: 'ai'`.

2. **`POST /api/themes/[themeId]/editor/ai-suggest` route** — accepts `{ sectionId, sectionType, fields, storeContext }`, calls Anthropic API (claude-sonnet-4-6), returns `{ suggestions: Record<string, string> }`. Rate-limited per store. Merchant session auth required via `resolveOwnedStoreId`.

3. **Auto-snapshot before AI edit session** — before the first AI suggestion is accepted in a session, trigger a manual draft save with `source: 'pre-ai-snapshot'`, creating a named restore point in `theme_draft_patches`. VersionTree surface exposes this as a "Before AI edits" entry.

4. **MCP integration for design generation** — expose the AI suggest endpoint as an MCP tool callable from Claude Code sessions. Schema: `{ themeId, storeName, sectionType, intent }`. Enables a developer or merchant-support agent to propose theme edits via natural language without opening the editor UI.

5. **A/B variant management** — `theme_release_variants` table, variant-aware preview token resolution in `storefront-runtime`, allocation control in the VersionTree panel. This is the highest-complexity item and requires ARB approval before implementation (it touches the canonical `publish_theme_release` RPC).

---

## 7. Non-Negotiable Editor Invariants

Based on governance rules (CLAUDE.md), the canonical-ledger-only validator, ART-17, and the architecture confirmed in source:

1. **`CenterPanel.tsx` must remain a React client component in `merchant-control-plane`** and must never be migrated to Liquid. It is admin UI on a different origin from the storefront; it has no Liquid context.

2. **`SchemaFormRenderer.tsx` must remain React** — it uses controlled inputs, `useState`, `fetch` for file upload, toast notifications, and `@letbuyy/ui` design-system components. It is not storefront content.

3. **Theme publish must go through `db.rpc('publish_theme_release', ...)`** — the canonical-ledger-only rule (CLAUDE.md money section) applies: direct `theme_releases.insert` from TypeScript is only the documented fallback for pre-migration environments; new code must use the RPC. The fallback path in `ThemeExecutionAdapter` is not a pattern to replicate.

4. **Preview token must be stored as SHA-256 hash only** — `createPreviewSession()` stores `token_hash` never the plaintext token. This invariant must be preserved in any AI or preset feature that creates preview sessions.

5. **`resolveOwnedStoreId` before any store-scoped theme mutation** — all draft/publish/rollback routes call `resolveOwnedStoreId(storeName)` first. Any new AI-suggest or preset-apply route must do the same; it must not accept a `storeId` from the client body directly.

6. **ART-17: no new React-per-section components after the Liquid freeze** — the editor shell (CenterPanel, SchemaFormRenderer, ThemeEditorInner, VersionTree, SectionTree) is permanently React and predates the freeze. New storefront section renderers must be Liquid (or the existing React registry for approved legacy sections). The editor shell itself is not a "section" in the ART-17 sense; it is admin UI and is exempt.

7. **`--lb-*` design tokens only in editor UI** — the design-system ratchet forbids new `rounded-[...]` / raw pixel values. Any new editor panel components (design tokens panel, AI suggestions panel, asset library) must use `@letbuyy/ui` components and `--lb-*` CSS custom properties.

8. **Draft conflict detection must be preserved** — `isStaleThemeEditorBaseVersion(currentVersion, baseVersion)` in `ThemeExecutionAdapter` must be checked on every save and publish. AI-applied suggestions that trigger auto-save must pass the current `baseVersion` to the draft endpoint and handle 409 responses.
