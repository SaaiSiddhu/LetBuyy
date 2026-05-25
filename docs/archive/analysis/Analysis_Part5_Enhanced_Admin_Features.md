# LetBuyy Multi-Tenant Store Platform — Comprehensive Analysis

> **Part 5 of 7** | Enhanced Admin Features — Bulk Actions, Command Palette, Activity Logs & Notifications
>
> **Date:** February 13, 2026 | **Version:** 3.0 (Blog-Integrated)
>
> **Prev:** [Part 4](./Analysis_Part4_Blog_Database_AdminCRUD.md) (Blog System) | **Next:** [Part 6](./Analysis_Part6_Ecommerce_Enhancements.md) (E-commerce)

---

## 23. Global Search — Command Palette (⌘K)

> Shopify-grade search experience across all content types

### 23.1 Command Palette Wireframe

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║  TRIGGER: ⌘K (Mac) / Ctrl+K (Windows) — anywhere in admin            ║
║                                                                       ║
║  ┌─────────────────────────────────────────────────────────────────┐  ║
║  │ 🔍 Search or jump to...                                        │  ║
║  │ ┌───────────────────────────────────────────────────────────┐  │  ║
║  │ │ nextjs                                                    │  │  ║
║  │ └───────────────────────────────────────────────────────────┘  │  ║
║  │                                                                │  ║
║  │ POSTS (3 results)                                              │  ║
║  │ ┌───────────────────────────────────────────────────────────┐  │  ║
║  │ │ ▸ Getting Started with Next.js 15     Draft • 2 days ago │  │  ║
║  │ │ ▸ Next.js Performance Optimization    Published • 1 wk   │  │  ║
║  │ │ ▸ Building APIs with Next.js          Published • 2 wks  │  │  ║
║  │ └───────────────────────────────────────────────────────────┘  │  ║
║  │                                                                │  ║
║  │ CATEGORIES (1 result)                                          │  ║
║  │ ┌───────────────────────────────────────────────────────────┐  │  ║
║  │ │ ▸ Next.js                              5 posts            │  │  ║
║  │ └───────────────────────────────────────────────────────────┘  │  ║
║  │                                                                │  ║
║  │ ACTIONS                                                        │  ║
║  │ ┌───────────────────────────────────────────────────────────┐  │  ║
║  │ │ + Create new post                       ⌘N               │  │  ║
║  │ │ 🌐 View site                            ⌘⇧V              │  │  ║
║  │ │ ⚙️ Open settings                        ⌘,               │  │  ║
║  │ └───────────────────────────────────────────────────────────┘  │  ║
║  │                                                                │  ║
║  │ ↑↓ Navigate  •  ⏎ Select  •  Esc Close                       │  ║
║  └─────────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

### 23.2 Implementation Spec

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    COMMAND PALETTE — IMPLEMENTATION SPEC                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LIBRARY      │ cmdk (by Paco Coursey) — 3KB gzipped                        │
│  SHORTCUT     │ ⌘K / Ctrl+K — global listener via useEffect                 │
│  DEBOUNCE     │ 200ms debounce on search input                               │
│  FUZZY MATCH  │ fuse.js for typo-tolerant matching                           │
│                                                                              │
│  SEARCH SCOPE:                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Content Type    │ Fields Searched         │ Icon   │ Actions           │  │
│  ├─────────────────┼────────────────────────┼────────┼───────────────────┤  │
│  │ Blog Posts      │ title, excerpt, tags    │ 📝     │ Edit, View, Del  │  │
│  │ Categories      │ name, description       │ 📁     │ Edit, View       │  │
│  │ Tags            │ name                    │ 🏷️     │ Edit             │  │
│  │ Comments        │ content, author_name    │ 💬     │ View, Moderate   │  │
│  │ Media           │ filename, alt_text      │ 🖼️     │ View, Copy URL   │  │
│  │ Products        │ name, SKU, description  │ 🛍️     │ Edit, View       │  │
│  │ Orders          │ order_number, customer  │ 📦     │ View, Process    │  │
│  │ Settings        │ section names           │ ⚙️     │ Navigate         │  │
│  └─────────────────┴────────────────────────┴────────┴───────────────────┘  │
│                                                                              │
│  SEARCH OPERATORS:                                                           │
│  • type:post status:draft                                                    │
│  • category:tech author:john                                                 │
│  • is:published has:comments                                                 │
│  • date:>2026-02-01                                                          │
│                                                                              │
│  KEYBOARD:                                                                   │
│  ↑↓ Navigate • ⏎ Open • ⇧⏎ Open in new tab • Esc Close • ⌘⌫ Clear        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 24. Bulk Actions System

### 24.1 Selection States

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    BULK ACTIONS — 4 SELECTION STATES                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STATE 1: NONE SELECTED                                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ☐ Posts (15)                            [+ New Post]  [Filter ▼]  [⋯] │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  STATE 2: PARTIAL SELECTION (3 of 15)                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ☑ 3 selected    [Publish] [Move to Draft] [Delete] [More ▼]  [Clear] │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  STATE 3: PAGE SELECTED (10 of 15)                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ☑ All 10 on this page  [Select all 15 posts] [Actions ▼]     [Clear] │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  STATE 4: ALL SELECTED (15 of 15)                                            │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ☑ All 15 posts    [Publish (15)] [Delete (15)] [More ▼]       [Clear]│  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 24.2 Bulk Actions Menu

```
┌──────────────────────────────────────────────────────┐
│                 BULK ACTIONS MENU                     │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Change Status       ▸  │ → Published               │
│  Set Category        ▸  │ → Draft                   │
│  Add Tags            ▸  │ → Archived                │
│  ─────────────────────  │                            │
│  Export as CSV           │                            │
│  Export as JSON          │                            │
│  ─────────────────────  │                            │
│  🗑️ Delete (3)          │                            │
│                                                      │
│  KEYBOARD SHORTCUTS:                                 │
│  ⌘A: Select all visible                             │
│  ⌘⇧A: Select all (across pages)                     │
│  Esc: Deselect all                                   │
│  ⌘⌫: Delete selected                                │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 24.3 Confirmation Dialog

```
┌────────────────────────────────────────────────┐
│                                                │
│  ⚠️ Confirm Bulk Delete                        │
│                                                │
│  You are about to delete 3 posts.              │
│  This action cannot be undone.                 │
│                                                │
│  Affected items:                               │
│  • "Getting Started with Next.js 15"           │
│  • "React Best Practices 2026"                 │
│  • "TypeScript Deep Dive"                      │
│                                                │
│  Type "DELETE" to confirm:                     │
│  ┌──────────────────────────────┐              │
│  │                              │              │
│  └──────────────────────────────┘              │
│                                                │
│  [Cancel]                  [🗑 Delete 3 Posts] │
│                                                │
└────────────────────────────────────────────────┘
```

---

## 25. Advanced Filters Panel

### 25.1 Filter UI

```
╔═══════════════════════════════════════════════════════════════════════╗
║  🔍 Filters                                    [Save View]  [Clear]  ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║  Status                                                               ║
║  ☐ All (15)  ☑ Published (12)  ☐ Draft (2)  ☐ Scheduled (1)        ║
║                                                                       ║
║  Category                                                             ║
║  [Select categories...                                          ▼]   ║
║  Selected: Web Development, React                                     ║
║                                                                       ║
║  Author                                                               ║
║  ○ Any  ● John Doe  ○ Jane Smith                                     ║
║                                                                       ║
║  Date Range                                                           ║
║  [Feb 1, 2026 ] to [Feb 13, 2026]                                    ║
║  Quick: [Today] [7 days] [30 days] [This year]                       ║
║                                                                       ║
║  Tags (any of)                                                        ║
║  [react, nextjs, typescript                                    ]     ║
║                                                                       ║
║  Views: Min [0] Max [∞]                                               ║
║                                                                       ║
║  Has Comments: ○ Any  ● Yes  ○ No                                    ║
║                                                                       ║
║  [Apply Filters (8 matches)]                          [Reset]        ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

### 25.2 Saved Views

```
┌──────────────────────────────────────────────────────────────────┐
│  SAVED FILTER VIEWS                                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📌 My Drafts                    (status:draft, author:me)       │
│  📌 High Priority                (tag:priority, status:!archived)│
│  📌 Needs Review                 (status:review)                 │
│  📌 Published This Week          (date:last_7d, status:published)│
│                                                                  │
│  [+ Save current filters as view]                                │
│                                                                  │
│  Implementation:                                                 │
│  • Stored in user_preferences JSONB column                       │
│  • Views are per-user, per-site                                  │
│  • Quick-access from filter dropdown                             │
│  • Sync across devices                                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 26. Activity Logs & Audit Trail

### 26.1 Activity Log View

```
╔═══════════════════════════════════════════════════════════════════════╗
║  SIDEBAR │  Activity Log                         [Export ▼]  [Filter] ║
║          │                                                            ║
║          │  ┌─ Today ──────────────────────────────────────────────┐  ║
║          │  │ 🟢 John published "10 Tips for Better UX"     2m ago│  ║
║          │  │ ✏️ John edited "Getting Started with Next.js"  15m   │  ║
║          │  │ 💬 Jane approved 3 comments                    1h   │  ║
║          │  │ 🗑 John deleted tag "deprecated"                2h   │  ║
║          │  └──────────────────────────────────────────────────────┘  ║
║          │                                                            ║
║          │  ┌─ Yesterday ──────────────────────────────────────────┐  ║
║          │  │ 📝 Jane created "TypeScript Deep Dive"         9am  │  ║
║          │  │ 📁 John added category "DevOps"                11am │  ║
║          │  │ ⚙️ John changed settings: comments → approval   2pm  │  ║
║          │  │ 📤 Jane uploaded 5 images                      3pm  │  ║
║          │  │ 🔄 John bulk-published 4 draft posts           5pm  │  ║
║          │  └──────────────────────────────────────────────────────┘  ║
║          │                                                            ║
║          │  ←  1 2 3 ... 12  →                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

### 26.2 Activity Detail & Diff View

```
┌──────────────────────────────────────────────────────────────────────┐
│                    ACTIVITY DETAIL — DIFF VIEW                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ✏️ Edit: "Getting Started with Next.js 15"                          │
│  By: John Doe • 15 minutes ago • Version 3 → 4                      │
│                                                                      │
│  Changes:                                                            │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ FIELD          │ BEFORE              │ AFTER                   │  │
│  ├────────────────┼─────────────────────┼─────────────────────────┤  │
│  │ title          │ (unchanged)         │ (unchanged)             │  │
│  │ content        │ [View Diff →]       │ +248 words, -12 words  │  │
│  │ meta_descrip.  │ "Learn about..."    │ "Master Next.js 15..." │  │
│  │ focus_keyword  │ "nextjs"            │ "next.js 15"           │  │
│  └────────────────┴─────────────────────┴─────────────────────────┘  │
│                                                                      │
│  Content Diff (inline):                                              │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ - Next.js 15 introduces several new features                  │  │
│  │ + Next.js 15 introduces several groundbreaking features       │  │
│  │   that revolutionize React development.                       │  │
│  │                                                                │  │
│  │ + ## Performance Improvements                                  │  │
│  │ + Server Components now load 40% faster...                    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  [← Previous Version]  [Restore This Version]  [Next Version →]    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 27. Auto-Save & Version History

### 27.1 Auto-Save Behavior

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    AUTO-SAVE SYSTEM                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SAVE TRIGGERS:                                                              │
│  • Debounced: 2 seconds after last keystroke                                 │
│  • On blur: When user switches tab or window                                │
│  • Periodic: Every 30 seconds while editor is focused                       │
│  • Before navigation: When user clicks away from editor                     │
│                                                                              │
│  STATUS INDICATOR (bottom of editor):                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ● Saving...           (during save)                                    │  │
│  │ ✅ Saved 2 seconds ago (after successful save)                         │  │
│  │ ⚠️ Unsaved changes    (if save failed, retry in 5s)                    │  │
│  │ 📝 Editing...          (while typing, before debounce triggers)        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  VERSION RULES:                                                              │
│  • Auto-saves do NOT create new versions (saved as is_autosave = true)      │
│  • Manual saves create explicit versions                                     │
│  • Publishing always creates a version snapshot                              │
│  • Major edits (>50 word diff) create automatic snapshots                   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 27.2 Version History Panel

```
╔═══════════════════════════════════════════════════════════════════════╗
║  Version History — "Getting Started with Next.js 15"                  ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║  ┌─ Versions ─────────────────────────────────────────────────────┐  ║
║  │                                                                 │  ║
║  │ ● v4 (current)          Feb 13, 10:30 AM    John Doe           │  ║
║  │   "Updated SEO and added performance section"                   │  ║
║  │                                                                 │  ║
║  │ ○ v3                    Feb 12, 3:45 PM     John Doe           │  ║
║  │   "Added code examples"                                        │  ║
║  │                                                                 │  ║
║  │ ○ v2                    Feb 11, 11:00 AM    Jane Smith          │  ║
║  │   "Reviewed and edited for clarity"                             │  ║
║  │                                                                 │  ║
║  │ ○ v1                    Feb 10, 9:00 AM     John Doe           │  ║
║  │   "Initial draft"                                               │  ║
║  │                                                                 │  ║
║  └─────────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
║  [Compare v3 ↔ v4]   [Restore v3]   [Download Snapshot]              ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

---

## 28. Notification System

### 28.1 Notification Bell UI

```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║  HEADER:  ... [🔍][🔔 5][👤 John]                         ║
║                    │                                       ║
║                    ▼                                       ║
║  ┌──────────────────────────────────────────────────────┐  ║
║  │ Notifications (5 new)                 [Mark all read] │  ║
║  ├──────────────────────────────────────────────────────┤  ║
║  │ 🔵 New comment on "10 Tips for UX"        2 min ago │  ║
║  │    Sarah K. left a comment                           │  ║
║  │                                                      │  ║
║  │ 🔵 Post published: "TypeScript Deep..."   1 hr ago  │  ║
║  │    Scheduled post went live                          │  ║
║  │                                                      │  ║
║  │ 🔵 3 comments pending moderation           2 hrs ago │  ║
║  │    Review and approve comments                       │  ║
║  │                                                      │  ║
║  │ ○ Weekly analytics: +24% views             1 day ago │  ║
║  │                                                      │  ║
║  │ ○ Media storage: 75% used                 2 days ago │  ║
║  │                                                      │  ║
║  ├──────────────────────────────────────────────────────┤  ║
║  │ [View All Notifications →]                           │  ║
║  └──────────────────────────────────────────────────────┘  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

### 28.2 Notification Types & Channels

```
┌──────────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION SYSTEM CONFIG                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  TYPE                    │ IN-APP │ EMAIL │ PUSH │ DEFAULT          │
│  ────────────────────────┼────────┼───────┼──────┼──────────────────│
│  New comment             │   ✅   │  ✅   │  ✅  │ All on           │
│  Comment reply           │   ✅   │  ✅   │  ✅  │ All on           │
│  Post published          │   ✅   │  ❌   │  ❌  │ In-app only      │
│  Scheduled post live     │   ✅   │  ✅   │  ✅  │ All on           │
│  Pending moderation      │   ✅   │  ✅   │  ❌  │ In-app + email   │
│  Weekly analytics        │   ✅   │  ✅   │  ❌  │ In-app + email   │
│  Storage warning         │   ✅   │  ✅   │  ❌  │ In-app + email   │
│  New subscriber          │   ✅   │  ❌   │  ❌  │ In-app only      │
│  Security alert          │   ✅   │  ✅   │  ✅  │ All on           │
│  System update           │   ✅   │  ❌   │  ❌  │ In-app only      │
│                                                                      │
│  STORAGE:                                                            │
│  • Notifications stored in Supabase table                            │
│  • Real-time via Supabase Realtime channels                          │
│  • Auto-cleanup: archive after 30 days, delete after 90              │
│  • Badge count synced across tabs                                    │
│                                                                      │
│  PREFERENCES:                                                        │
│  • Per-user notification preferences (Settings > Notifications)      │
│  • Quiet hours (e.g., 10 PM - 8 AM)                                 │
│  • Per-channel toggle (in-app, email, push)                          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 29. Keyboard Shortcuts System

```
┌──────────────────────────────────────────────────────────────────────┐
│                    GLOBAL KEYBOARD SHORTCUTS                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  NAVIGATION                                                          │
│  ⌘K              Open command palette                                │
│  ⌘/              Show keyboard shortcuts help                        │
│  G then D        Go to Dashboard                                     │
│  G then P        Go to Posts                                         │
│  G then C        Go to Comments                                      │
│  G then S        Go to Settings                                      │
│  G then A        Go to Analytics                                     │
│                                                                      │
│  EDITING                                                             │
│  ⌘S              Save / Publish                                      │
│  ⌘⇧P             Preview                                             │
│  ⌘N              New post / New item                                 │
│  ⌘⌫              Delete selected                                     │
│  Esc             Close modal / Deselect                              │
│                                                                      │
│  LIST VIEWS                                                          │
│  ⌘A              Select all visible                                  │
│  ⌘⇧A             Select all (across pages)                           │
│  J/K             Navigate up/down in list                            │
│  X               Toggle selection on focused item                    │
│  ⏎               Open focused item                                   │
│                                                                      │
│  EDITOR (Tiptap)                                                     │
│  ⌘B              Bold                                                │
│  ⌘I              Italic                                              │
│  ⌘U              Underline                                           │
│  ⌘⇧X             Strikethrough                                       │
│  ⌘⇧7             Ordered list                                        │
│  ⌘⇧8             Bullet list                                         │
│  ⌘⇧9             Block quote                                         │
│  ⌘⌥1-6           Heading levels 1-6                                  │
│  ⌘E              Code (inline)                                       │
│  ⌘⇧E             Code block                                          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 30. Implementation — File Structure

```
apps/web/admin/app/[subdomain]/
├── components/
│   ├── CommandPalette.tsx          ← ⌘K global search (cmdk)
│   ├── BulkActionsBar.tsx          ← Selection toolbar + actions
│   ├── FilterPanel.tsx             ← Advanced filters with saved views
│   ├── ActivityFeed.tsx            ← Activity log timeline
│   ├── NotificationBell.tsx        ← Bell icon + dropdown
│   ├── VersionHistory.tsx          ← Version diff & restore
│   ├── KeyboardShortcuts.tsx       ← Shortcut overlay (⌘/)
│   └── ConfirmDialog.tsx           ← Reusable confirmation modal
│
├── hooks/
│   ├── useCommandPalette.ts        ← ⌘K trigger + search logic
│   ├── useBulkActions.ts           ← Selection state management
│   ├── useFilters.ts               ← Filter state + saved views
│   ├── useAutoSave.ts              ← Debounced auto-save with status
│   ├── useVersionHistory.ts        ← Version CRUD operations
│   ├── useActivityLog.ts           ← Activity log queries
│   ├── useNotifications.ts         ← Real-time notification listener
│   └── useKeyboardShortcuts.ts     ← Global keyboard event handler
│
├── lib/
│   ├── search.ts                   ← Fuse.js search configuration
│   ├── filters.ts                  ← Filter operators and logic
│   └── notifications.ts           ← Notification type definitions
```

---

## 31. Technology Additions for Part 5

```
┌──────────────────────────────────────────────────────────────────────┐
│                    NEW DEPENDENCIES — PART 5                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  PACKAGE           │ VERSION  │ PURPOSE                              │
│  ──────────────────┼──────────┼──────────────────────────────────────│
│  cmdk              │ ^1.0     │ Command palette (⌘K)                 │
│  fuse.js           │ ^7.0     │ Fuzzy search for command palette     │
│  dnd-kit           │ ^6.1     │ Drag-and-drop (reorder, widgets)     │
│  react-hotkeys-hook│ ^4.5     │ Keyboard shortcut management         │
│  diff              │ ^5.2     │ Content diff for version history     │
│  react-diff-viewer │ ^3.1     │ Side-by-side diff visualization      │
│  date-fns          │ ^3.6     │ Date formatting and manipulation     │
│  sonner            │ ^1.7     │ Toast notifications (non-blocking)   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

> **→ Continues in [Part 6](./Analysis_Part6_Ecommerce_Enhancements.md):**
> Inventory Management, Multi-Currency, Tax Engine, Shipping, Discounts & Coupons

---

> **Complete Series Navigation**
>
> | Part | Content |
> |------|--------|
> | [Part 1](./Analysis_Part1_Architecture_Database_DNS.md) | Architecture, Database Schema, DNS/SSL, Tech Stack |
> | [Part 2](./Analysis_Part2_Implementation_Onboarding_Email.md) | CSS System, Onboarding UI Wireframes, Email Templates |
> | [Part 3](./Analysis_Part3_Admin_Storefront_Deploy.md) | Admin Dashboard, Storefront, Dark Mode, Deployment |
> | [Part 4](./Analysis_Part4_Blog_Database_AdminCRUD.md) | Blog Database Schema, Admin CRUD Wireframes |
> | **Part 5** (this) | Bulk Actions, Command Palette, Activity Logs, Notifications |
> | [Part 6](./Analysis_Part6_Ecommerce_Enhancements.md) | Inventory, Multi-Currency, Tax, Shipping, Discounts |
> | [Part 7](./Analysis_Part7_Analytics_Performance_Deploy.md) | Analytics Dashboard, CI/CD, Performance, Security, Scaling |

