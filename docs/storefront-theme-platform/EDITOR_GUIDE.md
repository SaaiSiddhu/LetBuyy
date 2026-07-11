# LetBuyy Theme Editor — Shell Architecture Guide

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Last updated:** 2026-07-11 (post Phase Z)
**Covers:** editor header, section/block tree (incl. nested blocks), live preview inspector, settings panel (full Shopify-parity control set), template switcher, resource picker (Phase W live combobox), media library (Phase X modal image/video picker), app-block slot panel (Phase Y), translation editor (Phase Z), undo/redo, autosave, draft CAS

---

## 1. Overview

The visual editor shell is a single Next.js `'use client'` page at:

```
apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx
```

It is a **FOREIGN WIP FILE** — it carries prior user modifications. All phase-level changes to this file are applied as minimal, isolatable hunks. The file is 1810 lines (post Phase R).

Supporting components live under:
```
apps/merchant-control-plane/src/components/theme-editor/
  AppBlockSlotPanel.tsx        — Phase Y: app-block slot editor (add/configure/remove/reorder app blocks in a slot section)
  BlockChildRow.tsx            — recursive child-block tree row (Phase T, CLEAN)
  CenterPanel.tsx              — preview iframe, postMessage bridge, and inspector overlay host (CLEAN)
  ConflictDialog.tsx           — draft CAS conflict resolution dialog (Phase R, CLEAN)
  ExperiencePicker.tsx         — experience list and apply UI (CLEAN)
  PreviewInspectorOverlay.tsx  — hover chip overlay for the live preview (Phase S, CLEAN)
  SchemaFormRenderer.tsx       — settings form renderer; 26-type Shopify-parity control set (Phase U, CLEAN)
  SectionTreePanel.tsx         — ARIA section tree with drag-to-reorder (Phase R, CLEAN)
  TemplateSwitcherPanel.tsx    — Phase V: template type selector + alternate-variant list (CLEAN)
  controls/                    — Phase U: one file per extended control type

apps/merchant-control-plane/src/components/theme-locale/   — Phase Z: translation editor components
  LocaleSwitcher.tsx           — locale dropdown; DEFAULT_ADMIN_LOCALE='en-IN'; India-first default
  TranslationKeyList.tsx       — key/value list with missing-key detection; buildLocaleMap scopes to resource_type='theme'
  TranslationValueEditor.tsx   — inline key/value editor; resource_type:'theme' as const (RISK-DUAL-N01)
  theme-locale.module.css      — CSS module; --lb-* tokens only

apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/translations/
  page.tsx                     — Phase Z: server component; sibling to editor/page.tsx; does NOT modify editor/page.tsx
  TranslationEditorClient.tsx  — Phase Z: client component; useState(DEFAULT_ADMIN_LOCALE) India-first
    CheckboxControl.tsx        — native input[type=checkbox]; distinct from Toggle
    ColorBackgroundControl.tsx — solid colour picker OR CSS gradient string
    ColorSchemeControl.tsx     — select from named experience colour schemes
    FontPickerControl.tsx      — font family select constrained to EXPERIENCE_FONT_REGISTRY
    HtmlControl.tsx            — sanitised HTML textarea; no DOM injection in editor
    LiquidControl.tsx          — Liquid code textarea; NOT-CONNECTED badge (canary-OFF)
    VideoControl.tsx           — video URL + file upload (video/*); Phase X adds Browse Library button (MediaLibrary mediaType="video")
    VideoUrlControl.tsx        — YouTube / Vimeo URL; protocol + domain validated
    InfoControls.tsx           — FieldHeader (role=heading) + FieldParagraph (display-only)
    ResourcePickerControl.tsx  — product/collection/blog/page/menu: Phase W WAI-ARIA 1.2 combobox (live search) or Phase U NOT-CONNECTED fallback
    ImagePickerControl.tsx     — Phase X: URL text + upload + Browse Library button; replaces inline ImageInput for 'image' type in SchemaFormRenderer
    MediaLibrary.tsx           — Phase X: full-screen modal grid picker for uploaded images and videos; keyboard navigation + ARIA; same-origin proxy only
    controls.module.css        — supplemental styles; --lb-* tokens only; Phase X adds browseLibraryBtn, mediaLibrary* classes
```

All CSS is in `apps/merchant-control-plane/src/app/globals.css` (FOREIGN WIP FILE). The editor uses the `theme-os-*` token system throughout — no raw px or hex values.

---

## 2. Layout

The editor shell has a three-column layout:

```
┌─────────────────────────────────────────────────────────────────┐
│ Header / Topbar (.theme-os-topbar)                              │
│ [←] [Sections|Settings|Exp|Versions]  [Theme pill][Template]   │
│                          [Undo][Redo] [Save] [Publish]          │
├──────────────────┬──────────────────────┬───────────────────────┤
│ Left sidebar     │   Center panel       │  Right properties     │
│ .theme-os-       │   .theme-os-preview- │  .theme-os-properties │
│  sidebar         │    panel             │                       │
│ (panel tabs)     │  (device selector    │  (AI hooks + settings │
│                  │   + iframe)          │   SchemaFormRenderer) │
│                  │                      │                       │
└──────────────────┴──────────────────────┴───────────────────────┘
```

The left sidebar switches between four panel modes (`PanelMode` type): `'sections'` | `'settings'` | `'experiences'` | `'versions'`.

---

## 3. Editor Header

### 3.1 Left Zone

Icon buttons keyed on `panelMode` state. Active state via `theme-os-icon-btn--active`.

| Icon | `panelMode` | aria-label |
|---|---|---|
| `Layers3` | `'sections'` | Sections |
| `Settings` | `'settings'` | Theme settings |
| `Sparkles` | `'experiences'` | Experiences |
| `FileJson` | `'versions'` | Versions |

### 3.2 Center Zone

- **Theme-name pill**: `Blocks` icon + `themeName` state + `@letbuyy/ui Badge` (`'Draft'` / `'Saved'` variant driven by `isDirty`).
- **Template selector**: native `<select>` driven by `templateOptions` array; calls `handleTemplateChange` on change; disabled during `isSaving || isPublishing`. Phase V introduces `TemplateSwitcherPanel` as a standalone component for this role (see §3.4); wiring into `page.tsx` rides as WIP.

### 3.3 Right Zone

- **Undo / Redo**: `Undo2` / `Redo2` buttons; disabled via `canUndo` / `canRedo`; keyboard: `Cmd+Z` / `Cmd+Shift+Z` / `Cmd+Y`.
- **Save**: disabled when `isSaving || isPublishing || !isDirty`; shows `Loader2` spinner during save.
- **Publish**: disabled when `isSaving || isPublishing || isDirty` (draft must be saved clean before publishing); shows `Loader2` spinner during publish.

### 3.4 Template Switcher (`TemplateSwitcherPanel`) — Phase V

Source: `apps/merchant-control-plane/src/components/theme-editor/TemplateSwitcherPanel.tsx`

A standalone `'use client'` component (Phase V) providing template selection and alternate-variant browsing for the editor header. Driven entirely by caller-supplied props — no internal API calls.

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `templateOptions` | `TemplateSwitcherOption[]` | Yes | All available template keys (`{ key, label, type }`) |
| `selectedKey` | `string` | Yes | Currently selected template key |
| `onChange` | `(key: string) => void` | Yes | Emits key string only (RISK-DUAL-N01) |
| `disabled` | `boolean` | No | Guards all interactions |
| `alternateVariants` | `TemplateSwitcherVariant[]` | No | Named alternates for the current base type |
| `onCreateAlternate` | `(baseType: string) => void` | No | Intent signal only; never creates a template directly |
| `isLoading` | `boolean` | No | Shows skeleton state (`aria-busy`) |
| `error` | `string` | No | Shows error message |

**`useTemplateSwitcher(key)`** (exported): pure string parser. Splits on first `.`; `'customers/login'` → `{ baseType: 'customers/login', suffix: null }`. The `use*` naming is conventional; the function has no hook semantics and may be called anywhere.

**RISK-DUAL-N01 contract:** `onChange` and `onCreateAlternate` emit only string values. The component never accesses or mutates `section_definitions` or `block_definitions`. Contract is tested statically in `tests/theme-editor-v.test.mjs`.

**Alternate variant list:** When `alternateVariants` is provided, a `role="listbox"` container renders `role="option"` items with `aria-selected` + `tabIndex` + `Enter`/`Space` keyboard handler. Slash-containing keys (e.g., `'customers/login'`) are passed through as raw `<option value>` or listbox option values without encoding.

**Editor wiring:** The component is standalone and testable without `page.tsx`. Wiring into the editor header rides as foreign WIP alongside existing `page.tsx` edits, identical to the Phase R pattern (ConflictDialog, SectionTreePanel).

---

## 4. Left Sidebar — Panel Modes

### 4.1 Sections Panel (`SectionTreePanel`)

Source: `apps/merchant-control-plane/src/components/theme-editor/SectionTreePanel.tsx`

Renders three groups:
- **Header** (pinned, not draggable): single `SectionEntry` row for `state.sections.header`.
- **Template** (ARIA tree widget, draggable): list of `SectionEntry` rows for `state.sections.template`.
- **Footer** (pinned, not draggable): single `SectionEntry` row for `state.sections.footer`.

Below the footer group: a section-type selector (`Select`) and "Add" button.

**ARIA tree widget pattern** (WAI-ARIA authoring practices):
- `role="tree"` on the template list container with `aria-label="Template sections"`.
- `role="treeitem"` + `aria-selected` + roving `tabIndex` on each section row.
- Active item (selected section or parent section of selected block): `tabIndex=0`. All others: `tabIndex=-1`.
- Action buttons inside each treeitem: `tabIndex={-1}` (not in the Tab sequence; roving tabindex is on the outer div only).

**Keyboard navigation**: `ArrowDown` / `ArrowUp` on any focused treeitem moves focus to the next/previous treeitem. Event delegation on the `role="tree"` container — no per-row handler needed.

**HTML5 drag-to-reorder**: template section rows are `draggable={true}`. `handleDrop` computes the full step distance (`Math.abs(toIndex - dragIndex)`) and loops `onMoveSection(section.id, direction)`. Drag-over visual: `.theme-os-tree-section--drag-over` CSS class (token-only). Dragging row: `opacity: 0.45` inline.

**Block selection state**: when `selection.kind === 'block'`, the parent section row is the "active parent" — it receives `aria-selected=true` and `tabIndex=0` but does NOT get the visual selection highlight (`selected` prop stays `false`). This lets screen readers announce the structural context while the visual highlight correctly shows the parent as active-but-not-selected.

**Block sub-rows**: rendered via `BlockChildRow` (Phase T, see §4.5) inside the section row when `section.blocks.length > 0`. Flat blocks (no children) render byte-identically to Phase R.

**Child block callbacks (Phase T):** Three optional callbacks are available on `SectionTreePanelProps`:
- `onAddChildBlock(sectionId, parentBlockId, childType)` — add a new child block of `childType` under `parentBlockId`.
- `onRemoveChildBlock(sectionId, parentBlockId, childId)` — remove a child block by id.
- `onMoveChildBlock(sectionId, parentBlockId, childId, direction: -1|1)` — reorder a child block.

These are optional; callers that do not pass them (`page.tsx`) continue to function with the static nested block display. Wiring to `applyChange()` + `buildDraftConfig()` is a follow-up for the next phase that touches `page.tsx`.

**Add-child affordance (RISK-T05):** The add-child button in `BlockChildRow` renders only when `allowedChildTypes` is passed from the parent and `depth < MAX_EDITOR_BLOCK_DEPTH`. As of Phase T, `allowedChildTypes` is not yet resolved from the `blocks_schema` at the `SectionTreePanel` → `BlockChildRow` call site. The button is non-functional until RISK-T05 is addressed.

### 4.2 Settings Panel (`ThemeSettingsTree`)

Inline function in `page.tsx`. Renders a nav list of theme-settings groups from `settingsSchema.settings`. Each group is a `Button unstyled` with active class. Uses `TreeGroup` (imported from `SectionTreePanel`).

### 4.3 Experiences Panel (`ExperiencePicker`)

Source: `apps/merchant-control-plane/src/components/theme-editor/ExperiencePicker.tsx`

Calls `listExperiences()` from `@letbuyy/theme-engine`. Renders the 10 merchant experiences as swatches. Apply button with `aria-pressed` on the active experience.

### 4.4 Versions Panel (`VersionTree`)

Inline function in `page.tsx`. Renders a draft card (version + saved-at) and a published-releases list. Each release row shows version, date, and a rollback button. Uses `TreeGroup` (imported from `SectionTreePanel`).

---

## 5. Center Panel (`CenterPanel`)

Source: `apps/merchant-control-plane/src/components/theme-editor/CenterPanel.tsx`

### 5.1 Preview Iframe

URL: `{storefrontBaseUrl}/preview?subdomain={store}&editor=1&viewport={device}&theme_preview_token={token}`

Keyed on `previewUrl` — a new iframe is mounted only when the URL changes. Device CSS classes: `te-preview-frame--desktop` / `te-preview-frame--tablet` / `te-preview-frame--mobile`.

### 5.2 PostMessage Bridge (Phase S)

The bridge is a cross-origin protocol between the editor (`http://localhost:9001` dev / `https://admin.letbuyy.com` prod) and the preview iframe (`http://localhost:9000` dev / `https://store.letbuyy.com` prod). All constants are defined in `packages/theme-engine/src/editor-bridge-protocol.ts`.

**Outbound** (editor → preview): after `iframeLoadedRef.current === true`, three messages are posted to `targetOrigin = previewOrigin` (derived from `new URL(previewUrl).origin`):
- `EDITOR_LEGACY_SELECTION_MESSAGE` (`'LETBUYY_THEME_EDITOR_SELECTION'`) — backward compat; bridge translates this without scrolling (double-scroll fix, Phase S).
- `EDITOR_SELECTION_MESSAGE` (`'letbuyy:theme-editor:section-selected'`) — modern name; picked up directly by `EditorPreviewSectionFrame` listeners.
- `EDITOR_SCROLL_MESSAGE` (`'letbuyy:theme-editor:section-scroll'`) — explicit scroll intent; triggers `scrollIntoView` + flash in the bridge.

`previewOrigin` is `null` when `previewUrl` is empty. No message is ever sent when `previewOrigin` is null. No `'*'` wildcard is used.

**Inbound** (preview → editor) — `CenterPanel.handleMessage` with origin guard `if (!previewOrigin || event.origin !== previewOrigin) return`:

| Message type | Action |
|---|---|
| `EDITOR_SECTION_SELECT_MESSAGE` | Calls `onSelectSection(sectionId)` — user clicked a section in preview |
| `INSPECTOR_SECTION_HOVERED` | Sets `hoveredSection` state → `PreviewInspectorOverlay` shows chip; calls `onHoverSection?.(sectionId)` |
| `INSPECTOR_HOVER_CLEARED` | Clears `hoveredSection` state; calls `onHoverSection?.(null)` |
| `INSPECTOR_ADD_SECTION_INTENT` | Validates `adjacentSectionId` + `position` then calls `onAddSectionIntent?.(adjacentSectionId, position)` |

**Preview → editor send rule:** `EditorPreviewSectionFrame` reads `NEXT_PUBLIC_ADMIN_URL` via `getEditorOrigin()` for all sends. Sends are skipped (never `'*'`) when `getEditorOrigin()` returns empty string.

**Same-window dispatches:** The bridge (`StorefrontPreviewBridge`) re-posts `EDITOR_SELECTION_MESSAGE` and `INSPECTOR_SECTION_SCROLLED_TO` to `window.location.origin` only. `EditorPreviewSectionFrame` accepts these via `if (event.origin !== window.location.origin) return`.

**No-echo self-loop guard (preserved from Phase C):** The bridge translation branch matches only `LEGACY_SELECTION_MESSAGE || SCROLL_MESSAGE` — never `EDITOR_SELECTION_MESSAGE`. `INSPECTOR_SECTION_SCROLLED_TO` is excluded from the bridge's cross-origin handler by the origin guard (same-window dispatch origin ≠ editor origin).

### 5.3 PreviewInspectorOverlay (Phase S)

Source: `apps/merchant-control-plane/src/components/theme-editor/PreviewInspectorOverlay.tsx`

Rendered inside `.te-preview-body` by `CenterPanel`. Returns `null` when `hoveredSection` is null. When a section is hovered:
- Renders `.te-inspector-overlay` (`position: absolute; inset: 0; pointer-events: none; aria-hidden="true"`).
- Inside: `.te-inspector-hover-chip` with `MaterialIcon name="touch_app"` + `formatSectionLabel(sectionType)` text.
- The chip uses `--lb-*` tokens for colour, spacing, and radius (no raw hex or px).
- Animation: `te-inspector-chip-in` (0.12s ease; `prefers-reduced-motion: reduce` → `animation: none`).

This component contains no postMessage logic. All messaging is owned by `CenterPanel`. The overlay is purely visual — keyboard selection is handled by the section tree panel.

### 5.4 Device Switcher

Three buttons (`Monitor`, `Tablet`, `Smartphone`) in a `role="group" aria-label="Preview device"` container. Each button has `aria-pressed`. CSS: `.theme-os-device-toggle__btn--active` on the active button.

### 5.5 States

- **Syncing overlay**: shown when `isPreviewRefreshing` — spinner with "Syncing" label overlaid on the iframe.
- **Preview error overlay**: shown when `previewError` — error message with "Try again" button wired to `syncPreviewDraft()`.

---

## 6. Right Panel (`PropertyPanel`)

Inline function in `page.tsx` (lines 1658–1793). Rendered in `<aside.theme-os-properties aria-label="Theme properties">`.

### 6.1 AI Hooks Card (STUB)

Three buttons: Copy / Layout / Block. All call `applyAiHook(mode)` which applies hardcoded string/value changes to the selected section's settings. **This is a stub** — no AI service is called. See RISK-SEC-002. Phase AC must wire the real AI pipeline.

### 6.2 Settings Form (Phase U — full Shopify-parity control set)

Rendered via `SchemaFormRenderer` from `apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx`.

Three view modes keyed on `selection.kind`:
- `'theme'`: renders the selected `ThemeSettingsGroup.fields` from `settingsSchema`.
- `'section'`: renders `selectedSectionSchema.settings_schema` fields; block sub-list (click to enter block mode); add-block control.
- `'block'`: renders `selectedBlockSchema.fields` fields; back-to-section button (`X` icon).

**Schema type:** `SchemaFormRenderer` accepts `Record<string, ExtendedSchemaField>` (from `@letbuyy/theme-engine` via `@/lib/theme-schemas`). `ExtendedSchemaField` is a strict superset of the frozen `SchemaField` — all existing schemas remain valid.

**Conditional visibility:** fields with `visible_if: { field, value }` are skipped (not rendered) when the referenced sibling field's stored value does not strictly equal `value`. The hidden field's value is preserved in the settings record.

**Required validation:** fields with `required: true` show a `*` indicator. `validateFieldValue` returns an error string when the value is `null`, `undefined`, or `''`. Boolean controls (`toggle`, `checkbox`) do not raise a required error when `false` (RISK-SEC-U03).

**Type-safe defaults:** `resolveFieldDefault(field)` provides the display default when no stored value exists: `false` for boolean types, `field.min ?? 0` for numeric types, `null` for info types, `''` for all others.

**Supported field types (26 total):**

| Type | Component | Phase | Notes |
|------|-----------|-------|-------|
| `text` | `TextInput` | M (frozen) | `Input type=text`; required check; maxLength |
| `textarea` | `TextareaInput` | M (frozen) | `<textarea rows=3>`; required; maxLength |
| `richtext` | `TextareaInput` | M (frozen) | Same as textarea; no rich editor widget; no ARIA distinction |
| `radio` | `RadioInput` | M (frozen) | Button-group pills; `role="group"` + per-option `role="radio" aria-checked` |
| `color` | `ColorInput` | M (frozen) | Colour picker + hex text |
| `image` | `ImagePickerControl` | X | URL text + upload + Browse Library button (opens MediaLibrary modal); storeName-gated; `isUnsafeUrl` guard on library-selected URLs |
| `select` | `SelectInput` | M (frozen) | Native `<select>` from `field.options` |
| `toggle` | `ToggleInput` | M (frozen) | Slide switch; `role="switch" aria-checked` |
| `range` | `RangeInput` | M (frozen) | `input[type=range]`; min/max/step wired (Phase U fix) |
| `url` | `UrlInput` | M (frozen) | `Input type=url`; `isUnsafeUrl` guard (Phase U fix) |
| `number` | `NumberInput` | M (frozen) | `Input type=number`; min/max/step passed (Phase U fix) |
| `color_background` | `ColorBackgroundControl` | U | Solid colour picker OR CSS gradient string input |
| `color_scheme` | `ColorSchemeControl` | U | Select from named experience colour schemes |
| `font_picker` | `FontPickerControl` | U | Select from `EXPERIENCE_FONT_REGISTRY` (6 families); injection guard; font preview |
| `html` | `HtmlControl` | U | Textarea; no DOM injection; sanitise disclaimer; DOMPurify at renderer |
| `liquid` | `LiquidControl` | U | Monospace textarea; NOT-CONNECTED badge (canary-OFF) |
| `checkbox` | `CheckboxControl` | U | Native `input[type=checkbox]`; distinct from Toggle slide switch |
| `video` | `VideoControl` | U | URL + `video/*` upload; `isUnsafeUrl` guard |
| `video_url` | `VideoUrlControl` | U | YouTube / Vimeo HTTPS URL; `isUnsafeUrl` + pattern validation |
| `header` | `FieldHeader` | U | Display-only heading (`role="heading"`); no value; no onChange |
| `paragraph` | `FieldParagraph` | U | Display-only text block; no value; no onChange |
| `product` | `ResourcePickerControl` | W | WAI-ARIA 1.2 combobox (live search via `/api/stores/[store]/resource-search`); Phase U text-input fallback when `storeName` absent |
| `collection` | `ResourcePickerControl` | W | Same as product |
| `blog` | `ResourcePickerControl` | W | Same as product |
| `page` | `ResourcePickerControl` | W | Same as product |
| `menu` | `ResourcePickerControl` | W | Same as product |

Unknown types fall through to `TextInput` and never crash (backward compatibility).

**RISK-DUAL-N01:** all controls receive `(value, onChange)` only. The `field` descriptor is read-only schema metadata. No control mutates the schema. `onChange` writes to the instance settings value via `applyChange()`.

**Sanitize law:** `HtmlControl` and `LiquidControl` store the raw value in a `<textarea>`. No `dangerouslySetInnerHTML` in any control. HTML/Liquid → DOM rendering and DOMPurify sanitisation are the storefront renderer's responsibility.

For the complete per-type schema shape, validation rules, ARIA patterns, and sanitize notes, see `docs/storefront-theme-platform/phase-u/CONTROL_TYPE_REFERENCE.md`.

### 6.3 ResourcePickerControl (Phase W — Live Combobox)

Source: `apps/merchant-control-plane/src/components/theme-editor/controls/ResourcePickerControl.tsx`

Phase W upgrades `ResourcePickerControl` from a Phase U text-input placeholder to a live WAI-ARIA 1.2 combobox for the five resource field types (`product`, `collection`, `page`, `blog`, `menu`).

**Props:**

| Prop | Type | Required | Description |
|---|---|---|---|
| `value` | `string \| null` | Yes | Current resource id |
| `onChange` | `(id: string) => void` | Yes | Emits resource id string only (RISK-DUAL-N01) |
| `resourceType` | `string` | Yes | One of `product \| collection \| page \| blog \| menu` |
| `storeName` | `string` | No | Store URL path param; enables live combobox branch |
| `label` | `string` | No | Accessible label |
| `helpText` | `string` | No | Help text (linked via `aria-describedby`) |
| `error` | `string` | No | Error message |

**Branches:**

- **Live combobox** (when `storeName` is supplied): fetches from `/api/stores/{storeName}/resource-search?type={resourceType}&q={query}&limit=20` with 300 ms debounce. Shows the selected resource as a chip with title + clear button.
- **NOT-CONNECTED fallback** (when `storeName` is absent): Phase U plain text-input with NOT-CONNECTED badge. Backward-compat for any call site that does not pass `storeName`.

**WAI-ARIA 1.2 Combobox pattern:**

```
<div role="combobox" aria-expanded aria-haspopup="listbox" aria-controls aria-autocomplete="list" aria-activedescendant>
  <input type="text" />
</div>
<ul role="listbox">
  <li role="option" aria-selected id="…">Title</li>
</ul>
```

Keyboard: `ArrowDown` / `ArrowUp` navigate options; `Enter` selects; `Escape` closes. See RISK-W04 for a known ArrowUp edge case at initial state.

**Fetch proxy:** same-origin `/api/stores/{storeName}/resource-search`. The browser never accesses the gateway directly. `storeName` is resolved server-side by `resolveOwnedStoreId` before any gateway call — no cross-tenant access is possible from the component itself.

**RISK-DUAL-N01:** `onChange` emits only the resource id string. The component never handles `DynamicSourceDescriptor` objects. The caller (or `applyChange()` upstream) decides whether to wrap the id in a `ResourceBinding` descriptor for storage.

For the binding descriptor model and render-time resolution, see `docs/storefront-theme-platform/phase-w/DYNAMIC_SOURCES_REFERENCE.md`.

### 6.4 ImagePickerControl (Phase X — Browse Library)

Source: `apps/merchant-control-plane/src/components/theme-editor/controls/ImagePickerControl.tsx`

Phase X replaces the inline `ImageInput` for the `'image'` schema type with `ImagePickerControl`, which adds a Browse Library button that opens the `MediaLibrary` modal.

**Props:**

| Prop | Type | Required | Description |
|---|---|---|---|
| `value` | `string \| null` | Yes | Current image URL |
| `onChange` | `(url: string) => void` | Yes | Emits URL string only (RISK-DUAL-N01) |
| `storeName` | `string` | No | Store URL path param; enables Browse Library branch |
| `label` | `string` | No | Accessible label |
| `helpText` | `string` | No | Help text |

**Branches:**

- **URL text field** (always present): backward-compat; same as pre-X `ImageInput`. `isUnsafeUrl` guard on `handleUrlChange`.
- **File upload** (always present): POSTs to `/api/stores/{storeName}/upload` (pre-X path, unchanged).
- **Browse Library button** (when `storeName` is supplied): opens `MediaLibrary` modal with `mediaType="image"`. `handleLibrarySelect` applies `isUnsafeUrl` guard before calling `onChange`.

**Safety guards:**

- `isUnsafeUrl` is imported from `@/lib/theme-schemas` and applied on both the URL text path and the library-selected URL path.
- SVG rejection: the `MediaLibrary` component rejects `image/svg+xml` at the client-side `validateUploadFile` step before any R2 upload. A library-selected URL is also checked by `isUnsafeUrl` (which recognises `data:image/svg+xml` prefix). Double-layer defence.
- `onChange` emits a URL string only. RISK-DUAL-N01 is preserved.

**SchemaFormRenderer wiring:** `case 'image':` in `SchemaFormRenderer.tsx` renders `<ImagePickerControl label={...} value={...} onChange={...} storeName={storeName} helpText={...} />`. The `storeName` prop is threaded from `SchemaFormRenderer`'s own prop (not hardcoded).

### 6.5 MediaLibrary (Phase X — Modal Grid Picker)

Source: `apps/merchant-control-plane/src/components/theme-editor/controls/MediaLibrary.tsx`

`MediaLibrary` is a full-screen modal grid picker for browsing and selecting previously uploaded images or videos. It is opened by `ImagePickerControl` (for images) and `VideoControl` (for videos via `mediaType="video"`).

**Props:**

| Prop | Type | Required | Description |
|---|---|---|---|
| `storeName` | `string` | Yes | Store URL path param; used in same-origin proxy URL |
| `mediaType` | `'image' \| 'video' \| 'all'` | No | Filter passed to the proxy; default `'all'` |
| `onSelect` | `(url: string) => void` | Yes | Called with the selected asset URL; caller guards with `isUnsafeUrl` |
| `onClose` | `() => void` | Yes | Called on Escape or close button |

**States:** Loading skeleton → grid of thumbnail cells → empty state (no media) → error state (network/503). All three non-success states are distinct rendered branches with accessible labels.

**Grid layout:** CSS 2-column default; 3-column at ≥ 400 px (CSS breakpoint in `controls.module.css`). `ResizeObserver` on the grid element reads `getComputedStyle().gridTemplateColumns` to keep a `gridCols` React state value accurate across CSS breakpoints.

**Keyboard navigation:**

| Key | Action |
|---|---|
| `ArrowRight` | Move focus to next cell (or wrap to next row) |
| `ArrowLeft` | Move focus to previous cell (or wrap to previous row) |
| `ArrowDown` | Move focus down one row (`activeIndex + gridCols`) |
| `ArrowUp` | Move focus up one row (`activeIndex - gridCols`) |
| `Enter` / `Space` | Select focused cell → `onSelect(url)` |
| `Escape` | Close modal → `onClose()` |

`activeIndex` state drives focus: a `useEffect` calls `cellRefs.current[activeIndex]?.focus()` on every `activeIndex` change, ensuring the DOM focus moves with the keyboard. ArrowDown/Up arithmetic uses the `gridCols` state (not a hardcoded constant) so it remains correct when the CSS breakpoint changes the number of columns.

**ARIA structure:**

```html
<div role="dialog" aria-modal="true" aria-labelledby="media-library-title">
  <h2 id="media-library-title">Media Library</h2>
  <!-- search input, type filter, close button -->
  <div role="grid">
    <div role="gridcell" aria-label="Select {filename}" tabIndex={0 or -1}>
      <img aria-hidden="true" src={url} />
    </div>
    <!-- … -->
  </div>
</div>
```

`<img>` carries `aria-hidden="true"` so screen readers announce only the parent `gridcell` label and do not double-announce the filename.

**Upload affordance:** a file input inside the modal accepts images and videos (excluding `image/svg+xml`). `validateUploadFile` runs client-side MIME + size checks before posting to `/api/stores/{storeName}/upload`. On success the grid refreshes.

**NOT-CONNECTED:** the proxy fetches from `/api/stores/{storeName}/themes/media-library`. If R2 or the `media` table is unavailable the component shows the error state and does not crash. See `docs/storefront-theme-platform/phase-x/MEDIA_LIBRARY_REFERENCE.md` §8 for the full NOT-CONNECTED inventory.

For the complete API contract, storage architecture, MIME policy, and testing reference, see `docs/storefront-theme-platform/phase-x/MEDIA_LIBRARY_REFERENCE.md`.

### 6.6 AppBlockSlotPanel (Phase Y — App-Block Slot Editor)

Source: `apps/merchant-control-plane/src/components/theme-editor/AppBlockSlotPanel.tsx`

`AppBlockSlotPanel` is rendered within an app-block-slot section when the editor selects a section of type `'app-block-slot'`. It lists installed app block extensions and provides full CRUD over app-block slot instances.

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `storeName` | `string` | Yes | Store URL path param; used to build same-origin proxy URL |
| `sectionId` | `string` | Yes | ID of the slot section |
| `section` | section object | Yes | Current section state (blocks array) |
| `onAddBlock` | `(sectionId, type, settings) => void` | Yes | Add block; type always `'@app'` |
| `onUpdateBlockSettings` | `(sectionId, blockId, settings) => void` | Yes | Update block settings |
| `onRemoveBlock` | `(sectionId, blockId) => void` | Yes | Remove block from slot |
| `onMoveBlock` | `(sectionId, blockId, direction) => void` | Yes | Reorder block |

**States:**

| State | Trigger | UI |
|-------|---------|-----|
| Loading | Fetch in progress | `aria-busy` + spinner message |
| Error | Fetch failed | `role="alert"` error message |
| NOT-CONNECTED | Proxy returns `not_connected: true` (gateway 404) | NOT-CONNECTED badge + honest empty state |
| Empty | Zero installed extensions | "No apps installed" message |
| Populated | Extensions available | Add-from-picker list + installed block rows |

**Add flow:** The merchant selects an extension from the picker. `onAddBlock(sectionId, '@app', { extension_id, app_id, title, slot })` is called. Block type stays `'@app'` — `extension_id` is stored in `block.settings`, never used as a `block.type` override.

**Configure flow:** Clicking the Settings icon opens an inline `BlockSettingsForm` for `title` and `slot` editing. Escape closes the form. The block's `onUpdateBlockSettings` callback is called on each change.

**Proxy route:** `GET /api/stores/{storeName}/themes/app-blocks`

Returns `{ data: InstalledAppExtension[], not_connected: false }` on success, or `{ data: [], not_connected: true }` when the gateway endpoint `GET /themes/app-blocks` is not yet deployed. That endpoint reads `app_extension_registrations WHERE surface = 'theme.app_block'` and is the missing piece for a connected app runtime.

**SANDBOX LAW:** Zero `dangerouslySetInnerHTML` or `innerHTML` in this component. App HTML is rendered at storefront time through `resolveLiquidAppBlockHtml` → `sanitizeRenderedHtml` (locked DOMPurify). The component manages reference metadata only.

**RISK-DUAL-N01:** all mutations route through `onAddBlock` / `onUpdateBlockSettings` / `onRemoveBlock` / `onMoveBlock`. The component never reads or writes `section_definitions` or `block_definitions`.

**CSS classes (Phase Y additions to `controls.module.css`):**

| Class | Purpose |
|-------|---------|
| `.appBlockSlotWrapper` | Top-level slot wrapper; `aria-label` identifies the slot |
| `.appBlockItem` | Single extension row |
| `.appBlockItemSelected` | Active/configure-open row highlight |
| `.appBlockItemActions` | Row action button group (configure, remove, reorder) |
| `.appBlockNotConnected` | NOT-CONNECTED badge container |
| `.appBlockEmpty` | Empty state message |
| `.appBlockSettingsForm` | Inline configure form container |
| `.appBlockAddSection` | "Add app block" affordance container |
| `.appBlockAddBtn` | Primary "Add" button |

All classes use `--lb-*` design tokens only. No raw `px` or `rounded-[Npx]` values.

For the full app-block model, validation API, render path, and NOT-CONNECTED inventory, see `docs/storefront-theme-platform/phase-y/APP_BLOCK_REFERENCE.md`.

### 6.7 Translation Editor (Phase Z)

The translation editor is a **sibling route** to the main editor, not embedded in `editor/page.tsx`. It lives at:

```
apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/translations/
```

**Components:**

| Component | File | Role |
|-----------|------|------|
| `LocaleSwitcher` | `src/components/theme-locale/LocaleSwitcher.tsx` | Locale dropdown; `DEFAULT_ADMIN_LOCALE = 'en-IN'`; India-first default |
| `TranslationKeyList` | `src/components/theme-locale/TranslationKeyList.tsx` | Key/value list with missing-key detection |
| `TranslationValueEditor` | `src/components/theme-locale/TranslationValueEditor.tsx` | Inline key/value editor |
| `TranslationEditorClient` | `editor/translations/TranslationEditorClient.tsx` | Client component orchestrator |
| `page.tsx` | `editor/translations/page.tsx` | Server component; does NOT touch `editor/page.tsx` |

**Props flow:**
- `LocaleSwitcher` → `selectedLocale` state in `TranslationEditorClient`.
- `TranslationEditorClient` passes `defaultLocale={DEFAULT_ADMIN_LOCALE}` (`'en-IN'`) and `selectedLocale` to `TranslationKeyList`.
- `TranslationKeyList` renders rows and calls `onEdit(key, value, translationId?)` on edit intent.
- `TranslationValueEditor` handles the inline editing form and calls the proxy routes.

**Missing-key detection:** `TranslationKeyList.buildLocaleMap` compares the set of keys in the `DEFAULT_ADMIN_LOCALE` (`'en-IN'`) reference against the selected locale's `storefront_translations` rows. Keys present in `en-IN` but absent in the selected locale are shown with a Missing badge (`aria-label` for a11y). This gives merchants a clear list of strings to translate.

**Write boundary (RISK-DUAL-N01):**
- `TranslationValueEditor` writes `{ resource_type: 'theme' as const, ... }` via proxy routes.
- It NEVER writes to `section_definitions` or `block_definitions`.
- `buildDraftConfig` in `editor/page.tsx` is unaffected (Phase Z does not touch that file).

**Proxy routes:**

| Method | Proxy path | Gateway call |
|--------|-----------|-------------|
| `POST` | `/api/stores/[store]/localization/translations` | `api.createTranslation` |
| `PATCH` | `/api/stores/[store]/localization/translations/[translationId]` | `api.updateTranslation` |
| `DELETE` | `/api/stores/[store]/localization/translations/[translationId]` | `api.deleteTranslation` |

Both proxy routes use `resolveOwnedStoreId` + `createMerchantApiClient`. No direct Supabase access. Known gaps: RISK-Z03 (proxy `resource_type` not validated), RISK-Z04 (no default-locale deletion guard), RISK-Z05 (`resource_id` ownership not checked at proxy).

**Locale and currency helpers (Phase Z engine additions):**

`@letbuyy/theme-engine` now exports:

```typescript
THEME_DEFAULT_STORE_LOCALE  // 'en-IN'
normalizeLocale(locale)     // null/undefined/'' → 'en-IN'; underscore → hyphen; region uppercased
tLocale(key, locale, locales, replacements?)  // India-first 4-level fallback; prototype-safe
formatThemeCurrencyDisplay(amountMinorUnits, currencyCode?, locale?)  // presentational; fxConnected: false always
```

See `docs/storefront-theme-platform/phase-z/LOCALIZATION_REFERENCE.md` for the full locale model, fallback chain, known limitation (RISK-Z01 for bare `'en'` locale), and currency display honesty record.

---

## 7. Undo / Redo

**State:** `EditorHistory` = `{ past: EditorState[], future: EditorState[] }`. Max depth: 50 (`past.slice(-49)` in `applyChange`).

**`undo()`:**
1. Pops `current.past[-1]` → `previous`.
2. `setEditorState(previous)`.
3. `setIsDirty(previous !== savedState)` — reference equality. If `previous` IS `savedState`, the SaveBar shows "Saved" (Phase R hardening; pre-Phase-R always set `true`).
4. Pushes `editorState` onto `future`.

**`redo()`:**
1. Pops `current.future[0]` → `next`.
2. `setEditorState(next)`.
3. `setIsDirty(true)` (always dirty after redo — redo reinstates an unsaved edit).
4. Pushes `editorState` onto `past`.

**Keyboard:** `Cmd+Z` → `undo()`, `Cmd+Shift+Z` / `Cmd+Y` → `redo()`, `Cmd+S` → `handleSave()`. Bound via `window.addEventListener('keydown', ...)` in `useEffect`.

**History cleared on save:** `saveDraft()` sets `setHistory({ past: [], future: [] })` on success, making undo unavailable after a save.

---

## 8. Autosave and Draft CAS

### 8.1 Autosave Trigger

`useEffect` on `[isDirty, isLoading, loadError, store, syncPreviewDraft, themeId]`:
- When `isDirty`: schedules `syncPreviewDraft()` after **900 ms**.
- When first loaded (not dirty): runs `syncPreviewDraft()` immediately (0 ms).
- Effect cleanup cancels the pending timeout on every re-render.

### 8.2 `syncPreviewDraft`

1. POST `/api/themes/[themeId]/editor/draft?store_name=&template=` with:
   ```json
   { "draftConfig": ..., "templateKey": "...", "baseVersion": <draftVersion | undefined> }
   ```
2. **409 guard:** if `res.status === 409` → sets `hasConflict=true`, `conflictSource='autosave'`, returns early (autosave is paused until the merchant resolves the conflict).
3. On success: extracts `version` and `savedAt` from the draft response; updates `draftVersion`, `savedAt`.
4. POST `/api/themes/[themeId]/preview-session` to obtain a fresh `preview_token`.
5. Updates `previewToken` in state → `CenterPanel` re-renders the iframe URL.
6. `previewRequestCounter` ref guards against stale responses from concurrent requests.

### 8.3 `saveDraft` (Manual Save and Force-Save)

```typescript
saveDraft(force = false)
```

Same POST as `syncPreviewDraft` but:
- When `force=true` (force-save from ConflictDialog): sends `baseVersion: undefined` to bypass the CAS check.
- **409 guard:** if `res.status === 409` → sets `hasConflict=true`, `conflictSource='manual-save'`, throws `ConflictError`.
- `handleSave` suppresses the toast for `ConflictError` (let the ConflictDialog handle it).
- On success: sets `setSavedState(editorState)`, clears history, sets `isDirty=false`.

### 8.4 Draft Proxy Route

`apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/draft/route.ts`

- **POST**: Calls `createMerchantApiClient().themes.saveDraft()` → api-client PUT `/themes/:slug/editor/draft` → gateway. Returns `{ success, savedAt, version, templateKey }`.
- **DELETE**: Calls `api-client.themes.deleteDraft()` for discarding drafts.
- HTTP 409 from the gateway propagates through `LetbuyyApiError` → `merchantApiErrorResponse` → `NextResponse 409` to the browser.

### 8.5 `baseConfig` and RISK-DUAL-N01

`baseConfig` holds the draft configuration as returned by the editor API at load time. `buildDraftConfig(baseConfig, themeId, editorState, selectedTemplateKey)` merges the mutable `editorState` (sections, settings, selected template) over `baseConfig`. The immutable `section_definitions` and `block_definitions` (Liquid source) always come from `baseConfig`, never from `editorState`. This mechanically enforces RISK-DUAL-N01.

**Phase V extension:** `TemplateSwitcherPanel.onChange(key)` emits only the key string; the caller passes it as `selectedTemplateKey` to `buildDraftConfig`. The panel never receives `section_definitions` or `block_definitions` — it has no props for them. `onCreateAlternate(baseType)` is an intent signal only; the caller is responsible for creating a `ThemeDocumentTemplate` instance via the normal `applyChange()` + `buildDraftConfig()` path. RISK-DUAL-N01 is preserved.

**Phase X extension:** `ImagePickerControl.onChange(url)` and `VideoControl.handleLibrarySelect(url)` both emit only a URL string. Neither component receives a `DynamicSourceDescriptor`. When a merchant selects an asset from the `MediaLibrary` modal, the URL is checked by `isUnsafeUrl` and then emitted via `onChange`. The caller (`SchemaFormRenderer` → `applyChange()`) is responsible for any wrapping. RISK-DUAL-N01 is preserved for both new controls.

---

## 9. ConflictDialog (Phase R)

Source: `apps/merchant-control-plane/src/components/theme-editor/ConflictDialog.tsx`

Shown when `hasConflict === true`. Two props drive behavior:

| Prop | Action |
|---|---|
| `onReload` | Reload from server — calls `setHasConflict(false)` then `loadEditor()`. Local changes are discarded. This is the **safe** path. |
| `onForce` | Keep my changes — calls `setHasConflict(false)` then `saveDraft(true)` (force-save, bypasses `base_version`). Force-save failures surface a critical toast. |

**Light-dismiss contract:** Escape key and outside-click trigger `onClose` → `onReload` (the safe default). Force-save only fires on explicit "Keep my changes" button click (`onConfirm` → `onForce`). This mapping (`onConfirm={onForce}`, `onClose={onReload}`) is intentional and matches the `@letbuyy/ui ConfirmDialog` / Modal `useDismiss` behavior.

**`conflictSource`:** `'autosave'` (background 409) vs `'manual-save'` (explicit Save click 409) — drives different description text.

---

## 10. CSS Token System

All editor CSS uses the `theme-os-*` naming convention in `apps/merchant-control-plane/src/app/globals.css`.

### Key Classes

| Class | Purpose |
|---|---|
| `.theme-os` | Root layout container |
| `.theme-os--centered` | Loading / error full-screen center |
| `.theme-os-topbar` | Editor header bar |
| `.theme-os-topbar__left/center/right` | Topbar zones |
| `.theme-os-theme-pill` | Theme name + badge pill |
| `.theme-os-page-pill` | Template selector pill |
| `.theme-os-icon-btn` | Icon-only button; `.--active` for active state |
| `.theme-os-btn` | Text button (Save/Publish); `.--primary` for primary |
| `.theme-os-workspace` | Three-column layout container |
| `.theme-os-sidebar` | Left panel |
| `.theme-os-sidebar__header` | Sidebar schema-source + version badge header |
| `.theme-os-preview-panel` | Center panel |
| `.theme-os-preview-panel__header` | Preview header with device toggle |
| `.theme-os-preview-panel__canvas` | Iframe container |
| `.theme-os-properties` | Right properties aside |
| `.theme-os-properties__header` | Properties title + back button |
| `.theme-os-properties__body` | Properties form body |
| `.theme-os-tree` | Generic tree container |
| `.theme-os-tree__group` | Group header section |
| `.theme-os-tree__label` | Group label text |
| `.theme-os-tree__add` | Add-section control row |
| `.theme-os-tree-section` | Section row (`role="treeitem"`) |
| `.theme-os-tree-section--selected` | Active selection highlight |
| `.theme-os-tree-section--hidden` | Visibility toggled off |
| `.theme-os-tree-section--dragging` | Being dragged (`opacity: 0.45`) |
| `.theme-os-tree-section--drag-over` | Drop target indicator (token-only outline) |
| `.theme-os-tree-section__row` | Main row button |
| `.theme-os-tree-section__handle` | Grip / panel icon |
| `.theme-os-tree-section__actions` | Row action buttons |
| `.theme-os-tree-blocks` | Block sub-list |
| `.theme-os-tree-block` | Individual block row; `.--selected`; `.--hidden` |
| `.theme-os-tree-block__line` | Block connector line |
| `.theme-os-ai-card` | AI hooks card |
| `.theme-os-property-card` | Settings form card |
| `.theme-os-settings-link` | Theme-settings group nav link |
| `.theme-os-settings-link--active` | Active settings group |
| `.theme-os-version-card` | Draft version card |
| `.theme-os-release-row` | Published release row |
| `.theme-os-device-toggle` | Device switcher group |
| `.theme-os-device-toggle__btn` | Individual device button; `.--active` |
| `.theme-os-spin` | CSS `@keyframes spin` animation |
| `.theme-os-rotate-up` / `.theme-os-rotate-down` | ChevronRight rotation for move-up/move-down arrows |
| `.theme-os-state` | Loading/error state container |
| `.theme-os-muted` | Muted/empty state text |

CenterPanel, SchemaFormRenderer, and PreviewInspectorOverlay use `te-*` classes (also in `globals.css`).

**Phase S inspector classes (merchant-control-plane):**

| Class | Purpose |
|---|---|
| `.te-inspector-overlay` | `position: absolute; inset: 0; pointer-events: none; z-index: 10` — sits above iframe without intercepting clicks |
| `.te-inspector-hover-chip` | Hover label chip; `--lb-color-primary` background; `--lb-radius-full` border-radius; `te-inspector-chip-in` animation |
| `.te-inspector-hover-chip__label` | Chip text, `line-height: 1` |

**Phase S section-frame classes (storefront-runtime):**

| Class | Purpose |
|---|---|
| `.storefront-editor-section-frame--flash` | Transient 700 ms `sf-section-frame-flash` animation on scroll-to; `prefers-reduced-motion: reduce` → `animation: none` |
| `.storefront-editor-section-insert` | Base insert-button styles (hidden by default, revealed on section hover/focus/selection) |
| `.storefront-editor-section-insert--before` | Positioned above the section |
| `.storefront-editor-section-insert--after` | Positioned below the section |

---

## 4.5 BlockChildRow (Phase T)

Source: `apps/merchant-control-plane/src/components/theme-editor/BlockChildRow.tsx`

`BlockChildRow` is a recursive `'use client'` component that renders a single block instance and, when the block has children and `depth < MAX_EDITOR_BLOCK_DEPTH`, renders each child as a nested `<BlockChildRow depth={depth + 1} ...>`.

**Props:**
```typescript
type BlockChildRowProps = {
    block: BlockEntry;           // the block instance (may have .children)
    depth: 1 | 2 | 3;           // current nesting level (1 = direct section child)
    sectionId: string;
    parentBlockId: string;       // section.id at depth=1; parent block.id at depth 2+
    selectedBlockId?: string;
    blockLabel?: string;         // resolved from blocks_schema[block.type].name
    allowedChildTypes?: string[]; // types the parent allows as children
    onSelectBlock?: (blockId: string) => void;
    onAddChildBlock?: (sectionId: string, parentBlockId: string, childType: string) => void;
    onRemoveChildBlock?: (sectionId: string, parentBlockId: string, childId: string) => void;
    onMoveChildBlock?: (sectionId: string, parentBlockId: string, childId: string, direction: -1 | 1) => void;
}
```

**Depth cap:** `MAX_EDITOR_BLOCK_DEPTH = 3` (exported from `BlockChildRow.tsx`). The nested children container is rendered only when `depth < MAX_EDITOR_BLOCK_DEPTH && hasChildren`. Beyond depth 3 the recursion stops silently — any block at the depth cap displays without a child list.

**ARIA:** Each block row is wrapped in `div[role="treeitem"][aria-level={depth + 1}]` (1-indexed from section level). The `theme-os-tree-block--depth-N` CSS class modifier is applied for styling hooks.

**CSS classes (existing, no new rules required):**
- `.theme-os-tree-block` — the block button row (same as Phase R flat blocks)
- `.theme-os-tree-block--selected` — active selection highlight
- `.theme-os-tree-block--hidden` — visibility toggled off
- `.theme-os-tree-block--depth-N` — depth level modifier (N = 1, 2, or 3)

---

## 11. Editor State Model

```typescript
type EditorState = {
    themeSettings: JsonRecord           // flat key→value map for all theme settings
    sections: {
        header: SectionEntry | null     // pinned, always present in a valid theme
        footer: SectionEntry | null     // pinned, always present in a valid theme
        template: SectionEntry[]        // ordered list; drag/move-up/move-down mutate this
    }
}

type SectionEntry = {
    id: string           // stable UUID across edits
    type: string         // e.g. 'hero-section', 'product-grid'
    order: number        // rendered order (matches array index post-sort)
    visible: boolean     // visibility toggle
    settings: JsonRecord // section-level settings
    blocks: BlockEntry[] // ordered blocks within this section
}

// Phase T: BlockEntry is the canonical type; exported from SectionTreePanel.tsx.
// children is optional so all existing flat-block callers compile unchanged.
type BlockEntry = {
    id: string
    type: string
    order: number
    visible: boolean
    settings: JsonRecord
    children?: BlockEntry[]   // Phase T — nested child blocks; absent on flat/legacy blocks
}

type EditorSelection =
    | { kind: 'section'; sectionId: string }
    | { kind: 'block'; sectionId: string; blockId: string }
    | { kind: 'theme'; groupKey: string }
```

**Nested block depth:** `BlockEntry.children` supports up to `MAX_EDITOR_BLOCK_DEPTH = 3` levels. The `applyChange()` + `buildDraftConfig()` path serialises this to `ThemeBundleTemplateBlock.blocks` (keyed Record) + `block_order` (ordered ids). `block_definitions` (the type catalog, including `allowed_child_types`) always comes from `baseConfig` and is never mutated by child operations (RISK-DUAL-N01 preserved).

`applyChange(updater)` is the only mutation entry point. It: (1) derives the next state from the updater, (2) pushes the current state onto `history.past`, (3) sets `isDirty=true`, (4) sets the next state.

---

## 12. Key Risks Affecting This Module

| Risk ID | Severity | Description | Target |
|---|---|---|---|
| RISK-DUAL-N01 | MEDIUM | Editor save must reconstruct `section_definitions`/`block_definitions` from `baseConfig`, not `editorState` | Enforced mechanically by `buildDraftConfig`; Phase T/U controls receive value+onChange only; Phase V TemplateSwitcherPanel emits key string only (RISK preserved) |
| RISK-SEC-P01 | MEDIUM | `theme_editor_drafts` RLS checks `user_id` only, not `custom_user_id` | No client-side realtime subscription may be added until fixed |
| RISK-PERF-N01 | LOW | Large document serialization on each draft save | `buildDraftConfig` sends only mutable state; Liquid source comes from `baseConfig` not re-serialized |
| RISK-SEC-002 | INFO | AI hooks are stubs; must not be presented as connected | Phase AC |
| RISK-R01 | LOW | **CLOSED (Phase T)** — `BlockEntry.children` added to canonical type; remaining four shared types still mirrored | Next substantive `page.tsx` touch |
| RISK-T05 | MEDIUM | `allowedChildTypes` not passed from `SectionTreePanel` to `BlockChildRow` — add-child button dead | Phase AA or first `SectionTreePanel.tsx` touch |
| RISK-T04 | LOW | `RENDERER_MAX_BLOCK_DEPTH` is private — depth parity test cannot directly assert it | Phase AA or first `theme-renderer.ts` touch |
| RISK-SEC-U01 | MEDIUM | `isUnsafeUrl` narrow blocklist — `data:image/svg+xml`, `data:text/javascript`, `blob:` not blocked | **PARTIALLY ADDRESSED Phase X** — `isUnsafeUrl` extended to cover SVG data URIs and `blob:` in hardening; remaining `data:text/javascript` entries carried to Phase AA |
| RISK-SEC-U02 | MEDIUM | `ColorBackgroundControl` gradient mode: no `url()` CSS content check | Phase AA or first `ColorBackgroundControl.tsx` touch |
| RISK-SEC-U03 | MEDIUM | `required: true` on `checkbox`/`toggle` is a validation no-op | Phase AA or first `SchemaFormRenderer.tsx` touch |
| RISK-A11Y-U01 | MEDIUM | `TextInput`/`TextareaInput` missing `aria-describedby` on error element | Phase AA or first `TextInput.tsx`/`TextareaInput.tsx` touch |
| RISK-A11Y-U02 | LOW | `CheckboxControl`/`FontPickerControl`/`ColorSchemeControl` ternary `aria-describedby` drops helpText when error present | Phase AA or first affected control touch |
| RISK-STYLE-U01 | LOW | `LiquidControl` `fontSize: 12` raw pixel | Phase AA or first `LiquidControl.tsx` touch |
| RISK-STYLE-U02 | LOW | `controls.module.css` raw `px` spacing values (pre-Phase-W classes; Phase X new classes use tokens) | Phase AA or first `controls.module.css` token-pass touch |
| RISK-W01 | MEDIUM | `BINDING_BLOCKED_KEYS` parity with `BLOCKED_DROP_KEYS` not compile-time enforced | Phase AA or first `dynamic-source-binding.ts` touch |
| RISK-W04 | LOW | `ResourcePickerControl` `ArrowUp` from no-selection snaps to item 0 — WAI-ARIA 1.2 non-conformance | Phase AA or first `ResourcePickerControl.tsx` touch |
| RISK-W05 | LOW | Loading spinner invisible during 300 ms debounce window on first keystroke | Phase AA or first `ResourcePickerControl.tsx` touch |
| RISK-W06 | LOW | Block-level settings not resolved through `resolveDynamicSourceDescriptors` — raw descriptors reach Liquid | Phase AA or first `theme-renderer.ts` touch |
| RISK-X01 | LOW | R2 key path is user-scoped (`user.id`) not site-scoped — no cross-user isolation within a site bucket prefix | Phase AA or first storage-architecture review |
| RISK-Z01 | MEDIUM | `buildCandidates('en')` puts bare `'en'` before `'en-IN'` — India-first inverted for stores with `sites.locale='en'` | Phase AA or first `theme-locale.ts` touch |
| RISK-Z02 | LOW | Pre-existing `lookupTranslation` in `theme-renderer.ts` lacks BLOCKED_PATH_SEGMENTS guard | Earliest phase touching `theme-renderer.ts` |
| RISK-Z03 | LOW | Translation POST proxy does not validate `resource_type` at proxy layer | Phase AA or first translation proxy touch |
| RISK-Z04 | LOW | Translation DELETE proxy has no server-side guard against deleting default-locale (en-IN) rows | Phase AA or earliest security migration |
| RISK-Z05 | LOW | Translation POST proxy does not verify `resource_id` (themeId) belongs to resolved `storeId` | Phase AA or first translation proxy touch |
| RISK-Z06 | LOW | Gateway `deleteTranslation` handler has no locale guard (backend view of RISK-Z04) | Phase AA or earliest security migration |
