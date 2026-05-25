# LetBuyy Platform — Theme Editor, Marketplace & Standalone Theme Architecture

> **Doc 18 of 18** | Theme Editor UI, Section Customizer, Theme Marketplace Integration, Standalone Theme Architecture & Dynamic Rendering Pipeline
>
> **Version:** 1.0 | **Date:** February 17, 2026
>
> **Prev:** [17 Storefront Landing](./17_Storefront_Landing.md) | **Next:** —

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Current State Analysis](#2-current-state-analysis)
3. [URL Routing Architecture](#3-url-routing-architecture)
4. [Theme Editor — Full-Page Layout](#4-theme-editor--full-page-layout)
5. [Editor Header Bar](#5-editor-header-bar)
6. [Left Sidebar — Section Navigator](#6-left-sidebar--section-navigator)
7. [Center Panel — Live Preview](#7-center-panel--live-preview)
8. [Right Sidebar — Section Customizer](#8-right-sidebar--section-customizer)
9. [Section URL Deep-Linking](#9-section-url-deep-linking)
10. [Theme Settings Panel](#10-theme-settings-panel)
11. [Standalone Theme Architecture](#11-standalone-theme-architecture)
12. [Theme Marketplace — Admin Integration](#12-theme-marketplace--admin-integration)
13. [Themes Page — Enhanced UI](#13-themes-page--enhanced-ui)
14. [Section Schema to Form Renderer](#14-section-schema-to-form-renderer)
15. [API Endpoints — Theme Editor](#15-api-endpoints--theme-editor)
16. [Database Changes](#16-database-changes)
17. [Data Flow — Editor Save Pipeline](#17-data-flow--editor-save-pipeline)
18. [Component Architecture](#18-component-architecture)
19. [Responsive Editor Behavior](#19-responsive-editor-behavior)
20. [Keyboard Shortcuts](#20-keyboard-shortcuts)
21. [Undo/Redo System](#21-undoredo-system)
22. [File Change Manifest](#22-file-change-manifest)
23. [Testing Strategy](#23-testing-strategy)
24. [Document History](#24-document-history)

---

# PART 1 — Architecture, Routing & Editor Layout

---

## 1. System Architecture Overview

> **Cross-ref:** [14_Theme_Implementation §1 — System Architecture](./14_Theme_Implementation.md) | [10_Storefront_and_Themes §1 — Storefront Architecture](./10_Storefront_and_Themes.md)

### 1.1 High-Level Architecture

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                    LetBuyy Theme Editor — Full Architecture                        │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                         ENTRY POINTS                                        │ │
│  │                                                                             │ │
│  │  1. admin.letbuyy.store/{store}/online-store/themes                        │ │
│  │     └── Themes listing page (existing, enhanced with Edit button)          │ │
│  │                                                                             │ │
│  │  2. admin.letbuyy.store/{store}/online-store/themes/{theme_id}/editor                   │ │
│  │     └── Theme Editor page (NEW — Shopify-like full-screen editor)          │ │
│  │                                                                             │ │
│  │  3. admin.letbuyy.store/{store}/online-store/themes/{theme_id}/editor?section=...       │ │
│  │     └── Deep-link to specific section within editor                        │ │
│  │                                                                             │ │
│  │  4. themes.letbuyy.store                                                   │ │
│  │     └── Theme Marketplace (browse, preview, install)                       │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                        │                                          │
│                                        ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                    THEME EDITOR UI LAYER                                     │ │
│  │                                                                             │ │
│  │  ┌──────────┐  ┌──────────────────────────┐  ┌──────────────────────────┐ │ │
│  │  │  Header   │  │  Icon Rail (section nav)  │  │  Live Preview (iframe)   │ │ │
│  │  │  Bar      │  │                           │  │                          │ │ │
│  │  │ ← Back   │  │  📄 Sections              │  │  {store}.letbuyy.store   │ │ │
│  │  │ Theme    │  │  🎨 Theme Settings        │  │  ?preview=true           │ │ │
│  │  │ Name     │  │  📱 Responsive             │  │  &editor_token=...       │ │ │
│  │  │ [Save]   │  │                           │  │                          │ │ │
│  │  └──────────┘  └──────────────────────────┘  │  Receives postMessage()   │ │ │
│  │                                               │  for live CSS/data        │ │ │
│  │  ┌──────────────────────────────────────────┐│  updates                  │ │ │
│  │  │  Left Sidebar (section list / settings)  ││                          │ │ │
│  │  │                                          ││  ┌────────────────────┐  │ │ │
│  │  │  ☰ Header                                ││  │ Desktop / Tablet / │  │ │ │
│  │  │  ☰ Hero Banner           ← selected     ││  │ Mobile toggle      │  │ │ │
│  │  │  ☰ Product Grid                         ││  └────────────────────┘  │ │ │
│  │  │  ☰ Category Grid                        │└──────────────────────────┘ │ │
│  │  │  ☰ Testimonials                         │                              │ │
│  │  │  ☰ Newsletter                           │┌──────────────────────────┐ │ │
│  │  │  ☰ Footer                               ││  Right Sidebar            │ │ │
│  │  │                                          ││  (Section Customizer)     │ │ │
│  │  │  [+ Add section]                        ││                          │ │ │
│  │  └──────────────────────────────────────────┘│  Heading: [________]     │ │ │
│  │                                               │  Subheading: [________] │ │ │
│  │                                               │  Image: [Upload]        │ │ │
│  │                                               │  Height: [▼ Full]       │ │ │
│  │                                               │  Overlay: [====◉===]    │ │ │
│  │                                               │  Button Text: [_____]   │ │ │
│  │                                               └──────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                        │                                          │
│                                        ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                    DATA LAYER                                                │ │
│  │                                                                             │ │
│  │  ┌──────────────────┐  ┌─────────────────────┐  ┌──────────────────────┐ │ │
│  │  │ sites             │  │ store_themes         │  │ theme_editor_        │ │ │
│  │  │ • template_config │  │ • config_overrides   │  │ drafts (NEW)         │ │ │
│  │  │ • theme_id        │  │ • section_order      │  │ • draft_config       │ │ │
│  │  │ • status          │  │ • section_data       │  │ • auto_saved_at      │ │ │
│  │  └──────────────────┘  └─────────────────────┘  └──────────────────────┘ │ │
│  │                                                                             │ │
│  │  ┌──────────────────┐  ┌─────────────────────┐                            │ │
│  │  │ themes            │  │ sections/*.json      │                            │ │
│  │  │ • config          │  │ (schema files in     │                            │ │
│  │  │ • sections        │  │  theme folder)       │                            │ │
│  │  └──────────────────┘  └─────────────────────┘                            │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Feature Comparison — Shopify Theme Editor vs LetBuyy Theme Editor

| Feature | Shopify | LetBuyy Current | LetBuyy Target |
|---|---|---|---|
| **Full-screen Editor** | ✅ Dedicated `/editor` route | ❌ No editor page | ✅ `/{store}/online-store/themes/{id}/editor` |
| **Live Preview** | ✅ iframe with postMessage | ❌ Not implemented | ✅ iframe + postMessage |
| **Section List** | ✅ Left sidebar, drag-reorder | ❌ Not implemented | ✅ Left sidebar with section list |
| **Section Customizer** | ✅ Right sidebar, form fields | ❌ Not implemented | ✅ Schema-driven form renderer |
| **Section URL Deep-Link** | ✅ `?section=template--xxx__hero` | ❌ Not implemented | ✅ `?section={section_id}` |
| **Setting Deep-Link** | ✅ `&setting=template--xxx__text` | ❌ Not implemented | ✅ `&setting={setting_id}` |
| **Theme Settings** | ✅ Colors, typography, layout | ✅ Config in DB (partial) | ✅ Full theme settings panel |
| **Responsive Preview** | ✅ Desktop/Mobile toggle | ❌ Not implemented | ✅ Desktop/Tablet/Mobile |
| **Add Section** | ✅ Section picker modal | ❌ Not implemented | ✅ Section picker from theme |
| **Reorder Sections** | ✅ Drag & drop | ❌ Not implemented | ✅ Drag handles |
| **Hide/Show Section** | ✅ Eye icon toggle | ❌ Not implemented | ✅ Visibility toggle |
| **Undo/Redo** | ✅ Ctrl+Z / Ctrl+Y | ❌ Not implemented | ✅ History stack |
| **Auto-Save Draft** | ✅ Saves drafts | ❌ Not implemented | ✅ 5-second debounce |
| **Block System** | ✅ Nested blocks in sections | ❌ Not implemented | ✅ blocks_schema support |
| **Icon Rail** | ✅ Sections/Settings toggle | ❌ Not implemented | ✅ Icon rail navigation |

### 1.3 Key Design Principles

| Principle | Description |
|---|---|
| **Schema-Driven** | Section forms auto-generated from `sections/*.json` → `settings_schema` |
| **Iframe Isolation** | Live preview runs in iframe — CSS changes injected via `postMessage` |
| **Draft-First** | All edits saved as drafts; explicit "Save" publishes changes |
| **Deep-Linkable** | Every section and setting has a URL — shareable, bookmarkable |
| **Standalone Themes** | Each theme owns its sections, components, and renderer |
| **No Page Reload** | All settings changes reflected in real-time via postMessage |
| **Keyboard-First** | Full keyboard shortcut support (Ctrl+S, Ctrl+Z, Escape) |

---

## 2. Current State Analysis

### 2.1 Existing Themes Page

The current `[store]/online-store/themes/page.tsx` (504 lines) provides:

```
┌──────────────────────────────────────────────────────────────────┐
│ Online Store                                                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  🎨 Themes                         [View your store] [Import ▼]  │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ┌─────────────────────┐  ┌──────────────┐                │  │
│  │  │  Desktop Mockup      │  │ Mobile Mockup│                │  │
│  │  │  ┌────────────────┐  │  │ ┌──────────┐ │                │  │
│  │  │  │ Nav bar        │  │  │ │ Nav      │ │                │  │
│  │  │  ├────────────────┤  │  │ ├──────────┤ │                │  │
│  │  │  │ Hero gradient  │  │  │ │ Hero     │ │                │  │
│  │  │  │ CTA button     │  │  │ │ [Shop]   │ │                │  │
│  │  │  ├────────────────┤  │  │ ├──────────┤ │                │  │
│  │  │  │ Product grid   │  │  │ │ Products │ │                │  │
│  │  │  └────────────────┘  │  │ └──────────┘ │                │  │
│  │  └─────────────────────┘  └──────────────┘                │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │ ✅ Your store is live and visible to customers       │ │  │
│  │  │                                      [Unpublish]     │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                                                            │  │
│  │  ●●●● Urban Kicks                                        │  │
│  │  Current theme · modern · LetBuyy Team                    │  │
│  │  Version 1.0.0 ▼                                          │  │
│  │                                         [...] [Edit theme]│  │  ← NEEDS LINK
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ✨ Design your store in seconds                                  │
│  [AI prompt input________________________] [Generate themes]     │
│                                                                    │
│  ◆ Popular free themes                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ Aurora   │ │ Zenith   │ │ Ember    │ │ Explore more     │   │
│  │ gradient │ │ gradient │ │ gradient │ │ themes →          │   │
│  │ ●●●     │ │ ●●●     │ │ ●●●     │ │                   │   │
│  │ [Add]   │ │ [Add]   │ │ [Add]   │ │                   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│                                                                    │
│  Learn more about themes →                                        │
└──────────────────────────────────────────────────────────────────┘
```

**What's Missing:**
- "Edit theme" button has no `href` — doesn't navigate anywhere
- No theme editor route exists (`/online-store/themes/{id}/editor`)
- No section customizer UI
- No live preview with postMessage
- No section deep-linking via URL params

### 2.2 Existing Section Schemas

The Urban Kicks theme already has 4 section JSON schemas:

| File | Section Type | Settings Count | Blocks |
|---|---|---|---|
| `sections/hero.json` | `heroBanner` | 9 settings | `heroBannerSlide` blocks |
| `sections/product-grid.json` | `productGrid` | 11 settings | — |
| `sections/testimonials.json` | `testimonials` | 6 settings | `testimonialCard` blocks |
| `sections/footer.json` | `footer` | 12 settings | — |

**Missing schemas (to be created):**
- `sections/header.json`
- `sections/newsletter.json`
- `sections/category-grid.json`
- `sections/brand-marquee.json`
- `sections/trust-badges.json`

### 2.3 Existing API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/themes` | GET | Fetch all themes + current theme for store |
| `/api/themes/install` | POST | Install a theme (set `theme_id` on `sites`) |
| `/api/themes/publish` | POST | Toggle store status (published/draft) |

**Missing API Routes (to be created):**
- `GET /api/themes/{id}/editor` — Fetch editor data (sections, settings, template)
- `PUT /api/themes/{id}/editor` — Save editor changes (section data + settings)
- `POST /api/themes/{id}/editor/draft` — Auto-save draft
- `GET /api/themes/{id}/sections` — Get section schemas from theme folder
- `PUT /api/themes/{id}/sections/reorder` — Reorder sections

---

## 3. URL Routing Architecture

> **Cross-ref:** [04_Admin_Dashboard §3 — Route Structure](./04_Admin_Dashboard.md)

### 3.1 Route Map

```
admin.letbuyy.store/{store_name}/
├── online-store/
│   ├── themes/                          # Existing — themes listing
│   │   └── page.tsx                     # Enhanced with Edit button link
│   ├── pages/                           # Existing — page management
│   └── preferences/                     # Existing — SEO, analytics, etc.
│
└── online-store/themes/                  # Theme editor under online-store
    └── {theme_id}/                      # Dynamic segment (e.g., "urban-kicks")
        └── editor/                      # NEW — full-screen theme editor
            └── page.tsx                 # Editor page component
```

### 3.2 File System — Next.js App Router

```
apps/web/consumer/admin/src/app/[store]/
├── online-store/
│   └── themes/
│       └── page.tsx                     # MODIFY — add Edit button href
│
└── online-store/themes/                  # Under online-store namespace
    └── [themeId]/
        └── editor/
            ├── layout.tsx               # NEW — full-screen layout (no sidebar)
            └── page.tsx                 # NEW — editor page
```

### 3.3 Editor Layout — No Admin Sidebar

The editor uses a **dedicated layout** that hides the admin sidebar and header, providing a full-screen editing experience (identical to Shopify):

```typescript
// apps/web/consumer/admin/src/app/[store]/online-store/themes/[themeId]/editor/layout.tsx

export default function EditorLayout({ children }: { children: React.ReactNode }) {
    // This layout intentionally does NOT include the admin sidebar or header.
    // The editor has its own header bar with ← Back, theme name, and Save.
    return (
        <div className="theme-editor-layout">
            {children}
        </div>
    );
}
```

### 3.4 URL Query Parameters — Section Deep-Linking

```
Base URL:
admin.letbuyy.store/{store}/online-store/themes/{theme_id}/editor

With section selected:
admin.letbuyy.store/{store}/online-store/themes/{theme_id}/editor?section={section_id}

With section + specific setting focused:
admin.letbuyy.store/{store}/online-store/themes/{theme_id}/editor?section={section_id}&setting={setting_key}

Examples:
admin.letbuyy.store/letok/online-store/themes/urban-kicks/editor
admin.letbuyy.store/letok/online-store/themes/urban-kicks/editor?section=heroBanner
admin.letbuyy.store/letok/online-store/themes/urban-kicks/editor?section=heroBanner&setting=heading
admin.letbuyy.store/letok/online-store/themes/urban-kicks/editor?section=testimonials&setting=blocks.0.customerName
admin.letbuyy.store/letok/online-store/themes/urban-kicks/editor?section=themeSettings
admin.letbuyy.store/letok/online-store/themes/urban-kicks/editor?section=themeSettings&setting=colors.primary
```

### 3.5 Route Resolution Flow

```
User clicks "Edit theme" on themes page
         │
         ▼
Browser navigates to:
admin.letbuyy.store/{store}/online-store/themes/{themeId}/editor
         │
         ▼
Next.js App Router matches:
[store]/online-store/themes/[themeId]/editor/page.tsx
         │
         ▼
editor/layout.tsx renders (NO admin sidebar)
         │
         ▼
page.tsx fetches:
├── 1. Store data (template_config, theme_id, storeId)
├── 2. Theme metadata (theme.json from theme folder)
├── 3. Section schemas (sections/*.json from theme folder)
├── 4. Current section data (from template_config.sections)
└── 5. Draft data (from theme_editor_drafts if exists)
         │
         ▼
Renders ThemeEditor component with all data
         │
         ▼
Opens live preview iframe:
{store}.letbuyy.store?preview=true&editor_token={jwt}
```

---

## 4. Theme Editor — Full-Page Layout

### 4.1 Desktop Layout Wireframe (1440px)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ HEADER BAR (h: 56px, bg: #1a1a2e, position: fixed, top: 0, z: 100)          │
│                                                                                │
│  ← Back │ 🎨 Urban Kicks │ [Pages ▼] │              │ [Undo] [Redo] [Save] │
│          │                 │            │              │                       │
└────────────────────────────────────────────────────────────────────────────────┘
│          │                               │                          │          │
│ ICON     │  LEFT SIDEBAR                 │  CENTER PANEL            │ RIGHT    │
│ RAIL     │  (w: 280px)                   │  (flex: 1)               │ SIDEBAR  │
│ (w:52px) │                               │                          │ (w:300px)│
│          │                               │                          │          │
│ ┌──────┐ │ ┌───────────────────────────┐ │ ┌──────────────────────┐ │ ┌──────┐│
│ │      │ │ │                           │ │ │                      │ │ │      ││
│ │  📄  │ │ │  Sections                 │ │ │  ┌────────────────┐  │ │ │ Hero ││
│ │      │ │ │  ─────────────────        │ │ │  │ Device Toggle  │  │ │ │Banner││
│ │ sect │ │ │                           │ │ │  │ 🖥 📱 💻        │  │ │ │──────││
│ │ ions │ │ │  ☰ Header                 │ │ │  └────────────────┘  │ │ │      ││
│ │      │ │ │  ☰ Announcement Bar       │ │ │                      │ │ │Head- ││
│ ├──────┤ │ │  ─────────────────        │ │ │  ┌────────────────┐  │ │ │ing:  ││
│ │      │ │ │  Template                 │ │ │  │                │  │ │ │[____]││
│ │  🎨  │ │ │  ─────────────────        │ │ │  │  LIVE PREVIEW  │  │ │ │      ││
│ │      │ │ │  ☰ Hero Banner    ◀───    │ │ │  │  (iframe)      │  │ │ │Sub-  ││
│ │theme │ │ │  ☰ Product Grid          │ │ │  │                │  │ │ │head: ││
│ │sett- │ │ │  ☰ Category Grid         │ │ │  │  Renders the   │  │ │ │[____]││
│ │ings  │ │ │  ☰ Brand Marquee         │ │ │  │  actual store  │  │ │ │      ││
│ │      │ │ │  ☰ Testimonials          │ │ │  │  with current  │  │ │ │Image:││
│ ├──────┤ │ │  ☰ Trust Badges          │ │ │  │  theme config  │  │ │ │[Upld]││
│ │      │ │ │  ☰ Newsletter            │ │ │  │                │  │ │ │      ││
│ │  📱  │ │ │  ─────────────────        │ │ │  │  postMessage   │  │ │ │Height││
│ │      │ │ │  ☰ Footer                │ │ │  │  ↕ real-time   │  │ │ │[▼Full││
│ │resp- │ │ │                           │ │ │  │  updates       │  │ │ │      ││
│ │onsve │ │ │  ─────────────────        │ │ │  │                │  │ │ │Overl-││
│ │      │ │ │  [+ Add section]         │ │ │  │                │  │ │ │ay:   ││
│ │      │ │ │                           │ │ │  │                │  │ │ │[==◉=]││
│ │      │ │ │                           │ │ │  └────────────────┘  │ │ │      ││
│ │      │ │ │                           │ │ │                      │ │ │Button││
│ │      │ │ │                           │ │ │                      │ │ │[____]││
│ │      │ │ │                           │ │ │                      │ │ │      ││
│ └──────┘ │ └───────────────────────────┘ │ └──────────────────────┘ │ └──────┘│
│          │                               │                          │          │
└──────────┴───────────────────────────────┴──────────────────────────┴──────────┘
```

### 4.2 Layout CSS Grid

```css
.theme-editor-layout {
    position: fixed;
    inset: 0;
    display: grid;
    grid-template-rows: 56px 1fr;         /* header + body */
    grid-template-columns: 52px 280px 1fr 300px;  /* rail + left + center + right */
    background: var(--editor-bg, #f6f6f7);
    overflow: hidden;
}

.theme-editor-header {
    grid-column: 1 / -1;                  /* spans all columns */
    grid-row: 1;
}

.theme-editor-icon-rail {
    grid-column: 1;
    grid-row: 2;
}

.theme-editor-left-sidebar {
    grid-column: 2;
    grid-row: 2;
    overflow-y: auto;
}

.theme-editor-center {
    grid-column: 3;
    grid-row: 2;
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.theme-editor-right-sidebar {
    grid-column: 4;
    grid-row: 2;
    overflow-y: auto;
    border-left: 1px solid var(--border-primary);
}
```

---

## 5. Editor Header Bar

### 5.1 Header Wireframe

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                                                                                │
│  ┌─────┐  ┌──────────────────────┐  ┌─────────┐       ┌───┐ ┌───┐ ┌──────┐ │
│  │ ←   │  │ 🎨 Urban Kicks      │  │ Pages ▼ │       │ ↶ │ │ ↷ │ │ Save │ │
│  │Back │  │    Editing theme     │  │         │       │   │ │   │ │      │ │
│  └─────┘  └──────────────────────┘  └─────────┘       └───┘ └───┘ └──────┘ │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘

Dimensions:
├── Height: 56px
├── Background: #1a1a2e (dark)
├── Text color: #ffffff
├── z-index: 100
└── position: fixed, top: 0, width: 100%
```

### 5.2 Header Components

```typescript
interface EditorHeaderProps {
    storeName: string;          // e.g., "letok"
    themeName: string;          // e.g., "Urban Kicks"
    themeId: string;            // e.g., "urban-kicks"
    isDirty: boolean;           // true if unsaved changes exist
    isSaving: boolean;          // true during save API call
    canUndo: boolean;           // true if undo stack has entries
    canRedo: boolean;           // true if redo stack has entries
    onBack: () => void;         // Navigate to themes page
    onSave: () => void;         // Save all changes
    onUndo: () => void;         // Undo last change
    onRedo: () => void;         // Redo last undone change
    currentPage: string;        // "Home page" | "Product page" | etc.
    onPageChange: (page: string) => void;
}
```

### 5.3 Back Button Behavior

```
User clicks ← Back
       │
       ├── isDirty === false → Navigate to /{store}/online-store/themes
       │
       └── isDirty === true → Show confirmation dialog:
               ┌────────────────────────────────────────┐
               │  Unsaved changes                        │
               │                                         │
               │  You have unsaved changes. Do you want  │
               │  to save before leaving?                │
               │                                         │
               │  [Discard]  [Cancel]  [Save & Leave]    │
               └────────────────────────────────────────┘
```

### 5.4 Pages Dropdown

```
┌─────────────────────┐
│ Pages ▼              │
├─────────────────────┤
│ • Home page    ←    │  (currently editing)
│   Product page      │
│   Collection page   │
│   Cart page         │
│   Blog page         │
│   ─────────────     │
│   404 page          │
│   Password page     │
└─────────────────────┘
```

---

## 6. Left Sidebar — Section Navigator

### 6.1 Section List Wireframe

```
┌─────────────────────────────────┐
│  Sections                        │
│  ─────────────────────────────   │
│                                  │
│  Header                          │
│  ┌─────────────────────────────┐│
│  │ ☰  Header           👁 🗑  ││
│  └─────────────────────────────┘│
│                                  │
│  Announcement Bar                │
│  ┌─────────────────────────────┐│
│  │ ☰  Announcement Bar  👁 🗑  ││
│  └─────────────────────────────┘│
│                                  │
│  ─────────────────────────────   │
│  TEMPLATE                        │
│  ─────────────────────────────   │
│                                  │
│  ┌─────────────────────────────┐│
│  │ ☰  Hero Banner  ◀   👁     ││  ← selected (highlighted)
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │ ☰  Product Grid      👁     ││
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │ ☰  Category Grid     👁     ││
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │ ☰  Brand Marquee     👁     ││
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │ ☰  Testimonials      👁     ││
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │ ☰  Trust Badges      👁     ││
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │ ☰  Newsletter        👁     ││
│  └─────────────────────────────┘│
│                                  │
│  ─────────────────────────────   │
│                                  │
│  ┌─────────────────────────────┐│
│  │ ☰  Footer                   ││
│  └─────────────────────────────┘│
│                                  │
│  ─────────────────────────────   │
│                                  │
│  ┌─────────────────────────────┐│
│  │ + Add section                ││
│  └─────────────────────────────┘│
│                                  │
└─────────────────────────────────┘

Legend:
  ☰  = Drag handle (6-dot grip)
  👁 = Visibility toggle (show/hide section)
  🗑 = Delete section (not for required sections)
  ◀  = Currently selected indicator
```

### 6.2 Section Item Component

```typescript
interface SectionItemProps {
    section: {
        id: string;          // unique section instance ID
        type: string;        // "heroBanner", "productGrid", etc.
        name: string;        // Display name from schema
        visible: boolean;    // Whether section is rendered
        required: boolean;   // If true, cannot delete (hero, product_grid)
    };
    isSelected: boolean;     // Highlighted in sidebar
    onSelect: () => void;    // Click → open in right sidebar
    onToggleVisibility: () => void;
    onDelete: () => void;
    onDragStart: () => void;
    onDragEnd: () => void;
}
```

### 6.3 Add Section Modal

When user clicks "+ Add section":

```
┌─────────────────────────────────────────────────────┐
│  Add section                                    ✕    │
│  ─────────────────────────────────────────────────   │
│                                                      │
│  🔍 [Search sections...________________________]    │
│                                                      │
│  THEME SECTIONS                                      │
│  ─────────────────────────────────────────────────   │
│                                                      │
│  ┌────────────────────┐  ┌────────────────────┐     │
│  │  🖼               │  │  📦               │     │
│  │  Hero Banner       │  │  Product Grid      │     │
│  │  Full-width hero   │  │  Grid of products  │     │
│  └────────────────────┘  └────────────────────┘     │
│                                                      │
│  ┌────────────────────┐  ┌────────────────────┐     │
│  │  🏷               │  │  🏢               │     │
│  │  Category Grid     │  │  Brand Marquee     │     │
│  │  Browse categories │  │  Scrolling brands  │     │
│  └────────────────────┘  └────────────────────┘     │
│                                                      │
│  ┌────────────────────┐  ┌────────────────────┐     │
│  │  ⭐               │  │  ✅               │     │
│  │  Testimonials      │  │  Trust Badges      │     │
│  │  Customer reviews  │  │  Security badges   │     │
│  └────────────────────┘  └────────────────────┘     │
│                                                      │
│  ┌────────────────────┐                              │
│  │  📧               │                              │
│  │  Newsletter        │                              │
│  │  Email signup      │                              │
│  └────────────────────┘                              │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 6.4 Section Data Structure

```typescript
// Template config section entry
interface TemplateSectionEntry {
    id: string;              // Unique instance ID: "hero_jVaWmY"
    type: string;            // Section type: "heroBanner"
    visible: boolean;        // Show/hide toggle
    settings: Record<string, unknown>;  // Current settings values
    blocks?: BlockEntry[];   // For sections with blocks_schema
}

interface BlockEntry {
    id: string;              // Unique block instance ID
    type: string;            // Block type from blocks_schema
    settings: Record<string, unknown>;
}

// Full template config structure
interface TemplateConfig {
    sections: {
        header: TemplateSectionEntry;
        footer: TemplateSectionEntry;
        template: TemplateSectionEntry[];  // Ordered list of body sections
    };
    themeSettings: Record<string, unknown>;  // Global theme settings
}
```

---

*End of Part 1 — Continued in Part 2*

---

# PART 2 — Live Preview, Section Customizer & Theme Settings

---

## 7. Center Panel — Live Preview

### 7.1 Preview Architecture

```
┌──────────────────────────────────────────────────────┐
│  CENTER PANEL                                          │
│  ┌──────────────────────────────────────────────────┐│
│  │  Device Toggle Bar                                ││
│  │  ┌──────┐ ┌──────┐ ┌──────┐                     ││
│  │  │ 🖥️   │ │ 💻   │ │ 📱   │                     ││
│  │  │ Desk │ │ Tab  │ │ Mob  │                     ││
│  │  └──────┘ └──────┘ └──────┘                     ││
│  └──────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────┐│
│  │  IFRAME                                            ││
│  │  src: {store}.letbuyy.store?preview=true           ││
│  │       &editor_token={jwt}                          ││
│  │                                                    ││
│  │  ┌──────────────────────────────────────────────┐││
│  │  │  HEADER → HERO → PRODUCTS → NEWSLETTER       │││
│  │  │  → TESTIMONIALS → FOOTER                      │││
│  │  └──────────────────────────────────────────────┘││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

### 7.2 Device Viewport Sizes

| Device | Width | Behavior |
|---|---|---|
| Desktop | `100%` | iframe fills available center panel |
| Tablet | `768px` | iframe centered with gray surround |
| Mobile | `375px` | iPhone-style frame, centered |

### 7.3 PostMessage Communication Protocol

```typescript
// Messages from Editor → Preview iframe
interface EditorToPreviewMessage {
    type: 'LB_EDITOR_UPDATE';
    payload: {
        action: 'UPDATE_SECTION' | 'UPDATE_THEME' | 'TOGGLE_VISIBILITY'
                | 'REORDER_SECTIONS' | 'HIGHLIGHT_SECTION' | 'SET_VIEWPORT';
        sectionId?: string;
        sectionData?: Record<string, unknown>;
        themeSettings?: Record<string, unknown>;
        visible?: boolean;
        sectionOrder?: string[];
        viewport?: 'desktop' | 'tablet' | 'mobile';
    };
}

// Messages from Preview iframe → Editor
interface PreviewToEditorMessage {
    type: 'LB_PREVIEW_EVENT';
    payload: {
        action: 'SECTION_CLICKED' | 'PREVIEW_READY' | 'PREVIEW_ERROR';
        sectionId?: string;
        sectionType?: string;
        error?: string;
    };
}
```

### 7.4 Section Highlighting in Preview

When a section is selected in the left sidebar, the preview highlights it:

```css
/* Injected into preview iframe via postMessage */
[data-section-id="heroBanner"].lb-editor-highlight {
    outline: 2px solid #6366f1;
    outline-offset: -2px;
    position: relative;
}
[data-section-id="heroBanner"].lb-editor-highlight::before {
    content: 'Hero Banner';
    position: absolute;
    top: -28px; left: 0;
    background: #6366f1;
    color: white;
    padding: 4px 12px;
    font-size: 12px;
    border-radius: 4px 4px 0 0;
}
```

---

## 8. Right Sidebar — Section Customizer

### 8.1 Customizer Wireframe — Hero Banner Example

```
┌──────────────────────────────────┐
│  ← Hero Banner                    │
│  ──────────────────────────────   │
│                                   │
│  Heading                          │
│  ┌──────────────────────────────┐│
│  │ Step Into the Future          ││
│  └──────────────────────────────┘│
│                                   │
│  Subheading                       │
│  ┌──────────────────────────────┐│
│  │ Premium sneakers & street... ││
│  └──────────────────────────────┘│
│                                   │
│  Primary Button Text              │
│  ┌──────────────────────────────┐│
│  │ Shop Now                      ││
│  └──────────────────────────────┘│
│                                   │
│  Background Image                 │
│  ┌──────────────────────────────┐│
│  │ ┌────────────┐               ││
│  │ │  🖼 hero   │  [Change]     ││
│  │ │  .jpg      │  [Remove]     ││
│  │ └────────────┘               ││
│  └──────────────────────────────┘│
│                                   │
│  Overlay Opacity                  │
│  [==========◉======] 40%         │
│                                   │
│  Height                           │
│  ┌──────────────────────────────┐│
│  │ Full viewport           ▼    ││
│  └──────────────────────────────┘│
│                                   │
│  Text Alignment                   │
│  ┌──────┐ ┌──────┐ ┌──────┐     │
│  │ Left │ │Center│ │Right │     │
│  └──────┘ └──────┘ └──────┘     │
│                                   │
│  ──────────────────────────────   │
│  CAROUSEL SLIDES (Blocks)        │
│  ──────────────────────────────   │
│  ┌──────────────────────────────┐│
│  │ ☰ Slide 1             🗑    ││
│  └──────────────────────────────┘│
│  ┌──────────────────────────────┐│
│  │ ☰ Slide 2             🗑    ││
│  └──────────────────────────────┘│
│  [+ Add slide]                    │
└──────────────────────────────────┘
```

### 8.2 Customizer — Testimonials Example (with Blocks)

```
┌──────────────────────────────────┐
│  ← Testimonials                   │
│  ──────────────────────────────   │
│  Section Title: [______________]  │
│  Layout: [Carousel ▼]            │
│  Autoplay: [ON ◉]                │
│  Show Stars: [ON ◉]              │
│  ──────────────────────────────   │
│  TESTIMONIAL CARDS (Blocks)      │
│  ┌──────────────────────────────┐│
│  │ ☰ "Amazing quality..."  🗑  ││
│  │  ↓ (expanded)                 ││
│  │  Customer: [Sarah M._______] ││
│  │  Review:   [Amazing quality ] ││
│  │  Rating:   ⭐⭐⭐⭐⭐          ││
│  │  Product:  [Air Max 90______] ││
│  │  Avatar:   [Upload]           ││
│  └──────────────────────────────┘│
│  [+ Add testimonial]             │
└──────────────────────────────────┘
```

---

## 9. Section URL Deep-Linking

### 9.1 URL Pattern Mapping

| Action | URL | Effect |
|---|---|---|
| Open editor | `…/editor` | Shows section list, no section selected |
| Select section | `…/editor?section=heroBanner` | Opens Hero Banner in right sidebar |
| Focus setting | `…/editor?section=heroBanner&setting=heading` | Opens Hero, focuses heading field |
| Block setting | `…/editor?section=testimonials&setting=blocks.0.customerName` | Expands block 0, focuses name |
| Theme settings | `…/editor?section=themeSettings` | Shows theme settings panel |
| Theme color | `…/editor?section=themeSettings&setting=colors.primary` | Shows theme, focuses color picker |

### 9.2 URL Sync Hook

```typescript
function useEditorUrl() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const selectedSection = searchParams.get('section');
    const selectedSetting = searchParams.get('setting');

    const setSelectedSection = useCallback((sectionId: string | null) => {
        const params = new URLSearchParams(searchParams.toString());
        if (sectionId) params.set('section', sectionId);
        else params.delete('section');
        params.delete('setting');
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [searchParams, router, pathname]);

    return { selectedSection, selectedSetting, setSelectedSection };
}
```

---

## 10. Theme Settings Panel

### 10.1 Theme Settings Wireframe

```
┌──────────────────────────────────┐
│  Theme settings                   │
│  ──────────────────────────────   │
│                                   │
│  ▼ COLORS                        │
│  Primary:    [■] #000000          │
│  Secondary:  [■] #FFFFFF          │
│  Accent:     [■] #E5E5E5          │
│  Background: [■] #FFFFFF          │
│  Text:       [■] #1A1A2E          │
│                                   │
│  ▼ TYPOGRAPHY                     │
│  Heading Font: [Inter        ▼]  │
│  Body Font:    [Inter        ▼]  │
│                                   │
│  ▼ LAYOUT                        │
│  Border Radius: [====◉====] 12px │
│  Animations:    [ON ◉]           │
│  Shadows:       [ON ◉]           │
│                                   │
│  ▼ HEADER                        │
│  Style: [Sticky ▼]               │
│  Show Search: [ON ◉]             │
│                                   │
│  ▼ FOOTER                        │
│  Columns: [====◉====] 4          │
│  Payment Icons: [ON ◉]           │
│                                   │
│  ──────────────────────────────   │
│  PRESETS                          │
│  ┌──────┐ ┌──────┐ ┌──────┐     │
│  │ Deft │ │ Dark │ │ Hype │     │
│  └──────┘ └──────┘ └──────┘     │
└──────────────────────────────────┘
```

### 10.2 Theme Settings Data Flow

```
config/settings.json (schema)    → Renders form fields in right sidebar
        +                                           │
theme.json (defaults)             → Pre-fills form  │
        +                                           │
sites.template_config.themeSettings (overrides) →  │
                                                    ▼
                                   User edits → Debounce 300ms
                                        │
                                        ▼
                                   postMessage to iframe (real-time CSS var update)
                                        │
                                        ▼
                                   Add to dirty state → saved on explicit Save
```

---

## 11. Standalone Theme Architecture

> **Cross-ref:** [14_Theme_Implementation §4 — Seeded Themes](./14_Theme_Implementation.md)

### 11.1 Theme Folder Structure

```
consumer-storefront/stores/urban-kicks/
├── theme.json                       # Theme metadata, presets, supported sections
├── index.ts                         # Theme entry point (exports)
├── config/
│   └── settings.json                # Global theme settings schema
├── sections/                        # Section JSON schemas
│   ├── header.json                  # NEW
│   ├── hero.json                    # 9 settings + blocks
│   ├── product-grid.json            # 11 settings
│   ├── category-grid.json           # NEW
│   ├── brand-marquee.json           # NEW
│   ├── testimonials.json            # 6 settings + blocks
│   ├── trust-badges.json            # NEW
│   ├── newsletter.json              # NEW
│   └── footer.json                  # 12 settings
├── templates/
│   └── index.json                   # Default homepage template
├── dynamic/                         # LIVE DATA rendering components
│   ├── section-renderer.tsx         # Maps section type → component
│   ├── sections/                    # Per-section React components
│   │   ├── hero-banner.tsx
│   │   ├── product-grid.tsx
│   │   ├── category-grid.tsx
│   │   ├── brand-marquee.tsx
│   │   ├── testimonials.tsx
│   │   ├── trust-badges.tsx
│   │   ├── newsletter.tsx
│   │   └── footer.tsx
│   └── pages/                       # Page-level components
├── preview/                         # MOCK DATA for theme marketplace
├── assets/                          # theme.css, custom.js
└── locales/                         # en.json
```

### 11.2 Section Renderer

```typescript
// consumer-storefront/stores/urban-kicks/dynamic/section-renderer.tsx

const SECTION_REGISTRY: Record<string, React.ComponentType<SectionProps>> = {
    heroBanner: HeroBannerSection,
    productGrid: ProductGridSection,
    categoryGrid: CategoryGridSection,
    brandMarquee: BrandMarqueeSection,
    testimonials: TestimonialsSection,
    trustBadges: TrustBadgesSection,
    newsletter: NewsletterSection,
    footer: FooterSection,
};

interface SectionProps {
    settings: Record<string, unknown>;
    blocks?: BlockEntry[];
    storeData?: StoreData;
    isEditorPreview?: boolean;
}

export function UrbanKicksSectionRenderer({ sections, storeData, isEditorPreview }: Props) {
    return (
        <>
            {sections.filter(s => s.visible).map(section => {
                const Component = SECTION_REGISTRY[section.type];
                if (!Component) return null;
                return (
                    <div key={section.id} data-section-id={section.type}>
                        <Component
                            settings={section.settings}
                            blocks={section.blocks}
                            storeData={storeData}
                            isEditorPreview={isEditorPreview}
                        />
                    </div>
                );
            })}
        </>
    );
}
```

### 11.3 Rendering Pipeline

```
Customer visits {store}.letbuyy.store
    → middleware.ts rewrites to /store/{subdomain}
    → /store/[subdomain]/page.tsx (Server Component)
        1. Fetch store data (template_config, theme_id)
        2. Resolve theme_id → "urban-kicks"
        3. Load section-renderer.tsx
        4. Extract sections from template_config
        5. Fetch products, categories
        6. Render: Header → SectionRenderer → Footer
```


---

*End of Part 2 — Continued in Part 3*

---

# PART 3 — Schema Renderer, APIs, Database & File Manifest

---

## 12. Theme Marketplace — Admin Integration

### 12.1 Marketplace Flow

```
┌────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ themes.letbuyy │     │ admin.letbuyy    │     │ storefront       │
│ .store         │     │ .store/{store}/  │     │ {store}.letbuyy  │
│                │     │ themes           │     │ .store           │
│ Browse themes  │ ──→ │ Install theme    │ ──→ │ Live store with  │
│ Preview themes │     │ Edit theme       │     │ applied theme    │
│ Compare themes │     │ Switch themes    │     │                  │
└────────────────┘     └──────────────────┘     └──────────────────┘
```

### 12.2 Theme Installation Flow

```
User selects theme in marketplace/admin
         │
         ▼
POST /api/themes/install
    body: { themeId: "urban-kicks", storeId: "..." }
         │
         ├── 1. Validate theme exists in THEME_REGISTRY
         ├── 2. Load theme's templates/index.json as default template
         ├── 3. Merge with existing store data (products, categories)
         ├── 4. Update sites.theme_id = "urban-kicks"
         ├── 5. Update sites.template_config = merged config
         └── 6. Return { success: true }
```

---

## 13. Themes Page — Enhanced UI

### 13.1 Edit Button Enhancement

Current "Edit theme" button (line ~493 of themes page):

```diff
- <button className="edit-theme-btn">Edit theme</button>
+ <Link
+     href={`/${storeName}/themes/${currentTheme.slug}/editor`}
+     className="edit-theme-btn"
+ >
+     Edit theme
+ </Link>
```

### 13.2 Theme Actions Dropdown Enhancement

```
┌──────────────────────┐
│ •••  (three dots)     │
├──────────────────────┤
│ ✏️  Edit theme        │  → /{store}/online-store/themes/{id}/editor
│ 👁  Preview theme     │  → opens preview in new tab
│ 📄  Duplicate theme   │  → POST /api/themes/duplicate
│ 📥  Export theme      │  → downloads theme config JSON
│ ─────────────────     │
│ 🗑  Delete theme      │  → confirmation dialog
└──────────────────────┘
```

---

## 14. Section Schema to Form Renderer

### 14.1 Schema Field Type → React Component Mapping

| Schema `type` | React Component | Props |
|---|---|---|
| `text` | `<TextInput>` | `maxLength`, `placeholder` |
| `textarea` | `<TextArea>` | `maxLength`, `rows` |
| `richtext` | `<RichTextEditor>` | toolbar config |
| `color` | `<ColorPicker>` | swatches array |
| `image` | `<ImageUploader>` | `accept`, `maxSize` |
| `select` | `<Select>` | `options[]` |
| `toggle` | `<Toggle>` | — |
| `range` | `<RangeSlider>` | `min`, `max`, `step`, `unit` |
| `number` | `<NumberInput>` | `min`, `max` |
| `url` | `<UrlInput>` | validation |
| `radio` | `<RadioGroup>` | `options[]` |
| `checkbox_group` | `<CheckboxGroup>` | `options[]` |

### 14.2 Form Renderer Component

```typescript
interface SchemaFormRendererProps {
    schema: Record<string, SchemaField>;  // from section's settings_schema
    values: Record<string, unknown>;       // current setting values
    onChange: (key: string, value: unknown) => void;
    focusedSetting?: string;               // from URL ?setting= param
}

interface SchemaField {
    type: 'text' | 'textarea' | 'richtext' | 'color' | 'image'
        | 'select' | 'toggle' | 'range' | 'number' | 'url' | 'radio';
    label: string;
    default?: unknown;
    // Type-specific:
    maxLength?: number;
    options?: { value: string; label: string }[];
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    info?: string;         // Help text below field
}

function SchemaFormRenderer({ schema, values, onChange, focusedSetting }: SchemaFormRendererProps) {
    return (
        <div className="schema-form">
            {Object.entries(schema).map(([key, field]) => {
                const FieldComponent = FIELD_MAP[field.type];
                return (
                    <div key={key} className="schema-form-field" id={`setting-${key}`}>
                        <label>{field.label}</label>
                        <FieldComponent
                            value={values[key] ?? field.default}
                            onChange={(v: unknown) => onChange(key, v)}
                            autoFocus={focusedSetting === key}
                            {...field}
                        />
                        {field.info && <span className="field-info">{field.info}</span>}
                    </div>
                );
            })}
        </div>
    );
}
```

---

## 15. API Endpoints — Theme Editor

### 15.1 GET `/api/themes/[themeId]/editor`

Fetches all data needed to initialize the editor.

```typescript
// Response shape
interface EditorInitResponse {
    store: {
        id: string;
        name: string;
        subdomain: string;
        status: string;
    };
    theme: {
        slug: string;
        name: string;
        version: string;
        presets: ThemePreset[];
    };
    templateConfig: TemplateConfig;      // Current live config
    draftConfig: TemplateConfig | null;  // Auto-saved draft (if exists)
    sectionSchemas: Record<string, SectionSchema>;  // All section schemas
    themeSettingsSchema: ThemeSettingsSchema;        // Global settings schema
}
```

### 15.2 PUT `/api/themes/[themeId]/editor`

Saves the editor state (publishes changes).

```typescript
// Request body
interface EditorSaveRequest {
    templateConfig: TemplateConfig;
    themeSettings: Record<string, unknown>;
}

// Response
interface EditorSaveResponse {
    success: boolean;
    savedAt: string;    // ISO timestamp
    version: number;    // Config version number
}
```

### 15.3 POST `/api/themes/[themeId]/editor/draft`

Auto-saves draft (called every 5 seconds when dirty).

```typescript
// Request body
interface DraftSaveRequest {
    draftConfig: TemplateConfig;
}

// Response
{ success: true, savedAt: string }
```

### 15.4 GET `/api/themes/[themeId]/sections`

Returns all section schemas from the theme's `sections/` folder.

```typescript
// Response
interface SectionSchemasResponse {
    sections: Record<string, SectionSchema>;
    // e.g.: { heroBanner: {...}, productGrid: {...}, ... }
}
```

### 15.5 PUT `/api/themes/[themeId]/sections/reorder`

Reorders sections in the template.

```typescript
// Request body
{ sectionOrder: string[] }  // Array of section IDs in new order

// Response
{ success: true }
```

---

## 16. Database Changes

### 16.1 New Table: `theme_editor_drafts`

```sql
CREATE TABLE IF NOT EXISTS theme_editor_drafts (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id        UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
    theme_id        TEXT NOT NULL,
    draft_config    JSONB NOT NULL DEFAULT '{}',
    auto_saved_at   TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(store_id, theme_id)  -- One draft per store per theme
);

-- RLS
ALTER TABLE theme_editor_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage drafts"
    ON theme_editor_drafts FOR ALL
    USING (store_id IN (SELECT id FROM sites WHERE owner_id = auth.uid()));
```

### 16.2 Schema: `theme_editor_drafts` ER Diagram

```
┌───────────────────────────┐
│ theme_editor_drafts       │
├───────────────────────────┤
│ id           UUID (PK)    │
│ store_id     UUID (FK)    │──→ sites.id
│ theme_id     TEXT          │
│ draft_config JSONB         │
│ auto_saved_at TIMESTAMPTZ  │
│ created_at   TIMESTAMPTZ   │
├───────────────────────────┤
│ UNIQUE(store_id, theme_id)│
└───────────────────────────┘
```

---

## 17. Data Flow — Editor Save Pipeline

```
User edits a setting (e.g., heading text)
         │
         ▼
1. Local state update (React useState)
         │
         ├── 2a. postMessage to iframe (instant visual update)
         │
         ├── 2b. Push to undo stack
         │
         └── 2c. Mark as dirty (isDirty = true)
                  │
                  ├── 3. Auto-save debounce (5 sec)
                  │        └── POST /api/themes/{id}/editor/draft
                  │            └── UPSERT into theme_editor_drafts
                  │
                  └── 4. User clicks [Save]
                           └── PUT /api/themes/{id}/editor
                               ├── UPDATE sites.template_config = new config
                               ├── DELETE from theme_editor_drafts (clear draft)
                               ├── Invalidate storefront cache
                               └── Return { success: true, version }
```

---

## 18. Component Architecture

### 18.1 Component Tree

```
ThemeEditorPage (page.tsx)
├── EditorHeader
│   ├── BackButton
│   ├── ThemeInfo
│   ├── PageSelector
│   ├── UndoButton
│   ├── RedoButton
│   └── SaveButton
├── IconRail
│   ├── SectionsIcon (active indicator)
│   ├── ThemeSettingsIcon
│   └── ResponsiveIcon
├── LeftSidebar
│   ├── SectionList
│   │   ├── SectionItem (draggable, per section)
│   │   │   ├── DragHandle
│   │   │   ├── SectionName
│   │   │   ├── VisibilityToggle
│   │   │   └── DeleteButton (conditional)
│   │   └── AddSectionButton
│   └── AddSectionModal
│       ├── SearchInput
│       └── SectionCard (per available section type)
├── CenterPanel
│   ├── DeviceToggleBar
│   │   ├── DesktopButton
│   │   ├── TabletButton
│   │   └── MobileButton
│   └── PreviewIframe
└── RightSidebar
    ├── SectionCustomizer (when section selected)
    │   ├── SectionHeader (← back + section name)
    │   ├── SchemaFormRenderer
    │   │   ├── TextInput
    │   │   ├── ColorPicker
    │   │   ├── ImageUploader
    │   │   ├── Select
    │   │   ├── Toggle
    │   │   ├── RangeSlider
    │   │   └── NumberInput
    │   └── BlocksEditor (for sections with blocks_schema)
    │       ├── BlockItem (collapsible, draggable)
    │       └── AddBlockButton
    └── ThemeSettingsPanel (when theme settings selected)
        ├── ColorsSection
        ├── TypographySection
        ├── LayoutSection
        ├── HeaderSection
        ├── FooterSection
        └── PresetsSection
```

---

## 19. Responsive Editor Behavior

| Breakpoint | Layout Change |
|---|---|
| `≥ 1280px` | Full 4-column layout (icon rail + left + center + right) |
| `1024–1279px` | Right sidebar overlays center panel |
| `768–1023px` | Left sidebar collapsible, right sidebar as drawer |
| `< 768px` | Mobile: "Editor not supported on mobile" message with link back |

---

## 20. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/⌘ + S` | Save all changes |
| `Ctrl/⌘ + Z` | Undo last change |
| `Ctrl/⌘ + Shift + Z` | Redo last undone change |
| `Escape` | Deselect section / close modal |
| `Ctrl/⌘ + P` | Toggle device preview (Desktop → Tablet → Mobile) |
| `↑ / ↓` | Navigate section list |
| `Enter` | Select highlighted section |

---

## 21. Undo/Redo System

### 21.1 Implementation

```typescript
interface EditorHistoryState {
    past: TemplateConfig[];     // Undo stack (max 50)
    present: TemplateConfig;    // Current state
    future: TemplateConfig[];   // Redo stack
}

function useEditorHistory(initial: TemplateConfig) {
    const [history, setHistory] = useState<EditorHistoryState>({
        past: [],
        present: initial,
        future: [],
    });

    const pushState = useCallback((newState: TemplateConfig) => {
        setHistory(h => ({
            past: [...h.past.slice(-49), h.present],  // Keep max 50
            present: newState,
            future: [],  // Clear redo stack on new change
        }));
    }, []);

    const undo = useCallback(() => {
        setHistory(h => {
            if (h.past.length === 0) return h;
            const previous = h.past[h.past.length - 1];
            return {
                past: h.past.slice(0, -1),
                present: previous,
                future: [h.present, ...h.future],
            };
        });
    }, []);

    const redo = useCallback(() => {
        setHistory(h => {
            if (h.future.length === 0) return h;
            const next = h.future[0];
            return {
                past: [...h.past, h.present],
                present: next,
                future: h.future.slice(1),
            };
        });
    }, []);

    return {
        state: history.present,
        canUndo: history.past.length > 0,
        canRedo: history.future.length > 0,
        pushState, undo, redo,
    };
}
```

---

## 22. File Change Manifest

### 22.1 New Files

| # | File | Purpose |
|---|---|---|
| 1 | `admin/src/app/[store]/online-store/themes/[themeId]/editor/layout.tsx` | Full-screen editor layout (no sidebar) |
| 2 | `admin/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` | Theme editor page component |
| 3 | `admin/src/components/theme-editor/EditorHeader.tsx` | Editor header bar |
| 4 | `admin/src/components/theme-editor/IconRail.tsx` | Left icon rail |
| 5 | `admin/src/components/theme-editor/LeftSidebar.tsx` | Section list sidebar |
| 6 | `admin/src/components/theme-editor/SectionItem.tsx` | Draggable section row |
| 7 | `admin/src/components/theme-editor/CenterPanel.tsx` | Preview iframe container |
| 8 | `admin/src/components/theme-editor/RightSidebar.tsx` | Section customizer panel |
| 9 | `admin/src/components/theme-editor/SchemaFormRenderer.tsx` | Schema → form renderer |
| 10 | `admin/src/components/theme-editor/BlocksEditor.tsx` | Blocks list editor |
| 11 | `admin/src/components/theme-editor/ThemeSettingsPanel.tsx` | Global theme settings UI |
| 12 | `admin/src/components/theme-editor/AddSectionModal.tsx` | Section picker modal |
| 13 | `admin/src/components/theme-editor/DeviceToggle.tsx` | Desktop/Tablet/Mobile toggle |
| 14 | `admin/src/hooks/useEditorHistory.ts` | Undo/redo state management |
| 15 | `admin/src/hooks/useEditorUrl.ts` | URL ↔ editor state sync |
| 16 | `admin/src/app/api/themes/[themeId]/editor/route.ts` | GET/PUT editor data API |
| 17 | `admin/src/app/api/themes/[themeId]/editor/draft/route.ts` | Draft auto-save API |
| 18 | `admin/src/app/api/themes/[themeId]/sections/route.ts` | Section schemas API |
| 19 | `admin/src/app/api/themes/[themeId]/sections/reorder/route.ts` | Reorder sections API |
| 20 | `urban-kicks/sections/header.json` | Header section schema |
| 21 | `urban-kicks/sections/newsletter.json` | Newsletter section schema |
| 22 | `urban-kicks/sections/category-grid.json` | Category Grid section schema |
| 23 | `urban-kicks/sections/brand-marquee.json` | Brand Marquee section schema |
| 24 | `urban-kicks/sections/trust-badges.json` | Trust Badges section schema |
| 25 | `urban-kicks/dynamic/section-renderer.tsx` | Section type → component mapper |
| 26 | `supabase/migrations/0XX_theme_editor_drafts.sql` | Draft table migration |

### 22.2 Modified Files

| # | File | Change |
|---|---|---|
| 1 | `admin/src/app/[store]/online-store/themes/page.tsx` | Wire Edit button to editor route |
| 2 | `urban-kicks/templates/index.json` | Add new section entries |
| 3 | `urban-kicks/theme.json` | Update supported sections list |

---

## 23. Testing Strategy

### 23.1 Unit Tests

| Component | Test Cases |
|---|---|
| `SchemaFormRenderer` | Renders correct field types, handles onChange, focuses via URL param |
| `useEditorHistory` | Push, undo, redo, max stack size, clear redo on new change |
| `useEditorUrl` | Syncs section/setting to URL params, handles null values |
| `SectionItem` | Drag events, visibility toggle, delete (blocked for required) |

### 23.2 Integration Tests

| Flow | Steps |
|---|---|
| Editor load | Navigate → fetch store → fetch schemas → render editor |
| Section edit | Select section → edit field → verify postMessage sent |
| Save flow | Edit → Save → verify API call → verify draft cleared |
| Draft recovery | Edit → close → reopen → verify draft loaded |

### 23.3 E2E Tests (Browser)

| Scenario | Expected |
|---|---|
| Open themes page → click Edit → editor loads | Editor renders with preview iframe |
| Edit hero heading → preview updates instantly | postMessage delivers update |
| Ctrl+Z undoes last edit | Previous value restored |
| Add section → appears in list and preview | Section rendered in correct order |

---

## 24. Document History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-02-17 | LetBuyy Team | Initial creation — complete theme editor specification |

---

## 📚 Doc Series

| Doc | Title |
|---|---|
| [00](./00_Vision_and_PRD.md) | Vision, Personas & PRD |
| [01](./01_Platform_Architecture.md) | Platform Architecture |
| [02](./02_SupabaseSchema.md) | Database Schema |
| [03](./03_Auth_and_Security.md) | Auth & Security |
| [04](./04_Admin_Dashboard.md) | Admin Dashboard |
| [05](./05_Storefront_Consumer.md) | Storefront Consumer |
| [06](./06_API_Design.md) | API Design Patterns |
| [07](./07_CDN_and_Storage.md) | CDN, Storage & Media |
| [08](./08_AI_Features.md) | AI/ML Features |
| [09](./09_Analytics_and_Reporting.md) | Analytics & Reporting |
| [10](./10_Storefront_and_Themes.md) | Storefront & Themes |
| [11](./11_Billing_and_Subscriptions.md) | Billing & Subscriptions |
| [12](./12_Implementation_Roadmap.md) | Implementation Roadmap |
| [13](./13_Blog_System.md) | Blog System |
| [14](./14_Theme_Implementation.md) | Theme Technical Implementation |
| [15](./15_App_Store_Implementation.md) | App Store & Ecosystem |
| [16](./16_Customer_Management.md) | Customer Management |
| [17](./17_Storefront_Landing.md) | Storefront Landing |
| **[18](./18_Theme_Editor.md)** | **Theme Editor & Configuration** ← You are here |

---

> **End of Document 18** — Theme Editor, Marketplace & Standalone Theme Architecture
