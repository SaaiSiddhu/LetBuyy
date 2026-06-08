# LetBuyy — Light / Dark Mode Audit

**Auditor:** Principal Design Systems Architect / UI Governance
**Date:** 2026-06-09
**Scope:** Per-app dark-mode reachability, persistence, SSR flash handling, and parity — across 9 web apps and the Flutter merchant app.
**Method:** Traced each app's `layout.tsx`, providers, `globals.css`, and toggle components; verified persistence keys and DOM signals with `grep`. No code modified.

> **One-line verdict:** The token engine fully supports dark mode, but **dark mode is actually reachable by a user in only 4 of 9 web apps**, persisted under **3 incompatible keys**, signaled **2 different ways** (class vs attribute), and — because of the `auto`-vs-`.dark` cascade issue (`THEME_ARCHITECTURE_AUDIT.md` THEME-1) — works *to different degrees* even where present. The Flutter app, ironically, has the most complete and polished dark mode in the platform.

---

## 1. Per-app matrix (web)

All 9 apps consume `@letbuyy/ui`, wrap their root in `DesignSystemRoot`, and import `config/tailwind/letbuyy-tokens.css` at `globals.css:2`. `next-themes` is used by **zero** apps.

| App | `DesignSystemRoot theme=` | Dark reachable by user? | Persisted? (key) | DOM signal | SSR flash handling | Evidence |
|---|---|---|---|---|---|---|
| **marketing-site** | `auto` + bespoke `ThemeProvider` | **Yes** (system/light/dark) | Yes — `theme` | `data-theme` attr on `<html>` | **Good** (blocking script + `suppressHydrationWarning`) | `layout.tsx:198,223-227`; `ThemeProvider.tsx:35,53-60` |
| **theme-marketplace** | `auto` + bespoke provider | **Yes** (Sun/Moon nav button) | Yes — `theme-marketplace-theme` | `.light`/`.dark` class | **Good** | `layout.tsx:119-157`; `theme-provider.tsx:44-58`; `navbar.tsx:100-107` |
| **identity-platform** | `surface="identity"`, `auto` + per-page toggle | **Yes** (per auth page) | Yes — `letbuyy_theme` | `.dark` class | **Good** (themeScript + bg `<style>`) | `layout.tsx:91-122`; `login/page.tsx:122-133` |
| **merchant-control-plane** | `surface="admin"`, `auto` + HeaderBar switch | **Yes** | Yes — `letbuyy_theme` | `.dark` class | **Partial** (script + `suppressHydrationWarning`, **no** bg `<style>`) | `layout.tsx:41-64`; `HeaderBar.tsx:161-173` |
| **app-marketplace** | `surface="marketplace"`, `auto` | **No** — script *reads* `letbuyy_theme`, **no toggle UI**, never writes it | reads only | `.dark` class (script-driven) | Good (script + bg `<style>`) | `layout.tsx:90-119`; no `setItem`/toggle found |
| **developer-portal** | `surface="marketplace"`, `auto` | **No** — OS-only, no toggle | None | — | None (OS-driven) | `layout.tsx:96-98` |
| **storefront-runtime** | `surface="storefront"`, `auto` | **No** — no light/dark toggle | None | — | None (OS-driven) | `layout.tsx:41-44` |
| **platform-console** | `surface="operations"`, **`theme="dark"`** | **N/A** — hardcoded dark, no light path | None (fixed) | — | None (static) | `layout.tsx:43` |
| **platform-operations-portal** | `surface="operations"`, `auto` | **No** — OS-only, no toggle | None | — | None (OS-driven) | `layout.tsx:43` |

**Tally:** reachable user toggle = **4/9** (marketing-site, theme-marketplace, identity-platform, merchant-control-plane). OS-driven only = **3/9**. Hardcoded dark = **1/9**. Dead-end consumer = **1/9** (app-marketplace).

---

## 2. Findings

### LDM-1 — Dark mode is only user-reachable in 4 of 9 apps; the rest are OS-locked, hardcoded, or dead-ended
**Severity: High** · **Affected: app-marketplace, developer-portal, storefront-runtime, platform-operations-portal, platform-console**

**Root cause.** No shared theme controller (`THEME_ARCHITECTURE_AUDIT.md` THEME-2), so adding a toggle was each app's optional homework. Five apps skipped it. A shopper or operator on a light-OS machine cannot choose dark in those apps; `platform-console` users cannot choose light.

**Code evidence.** See matrix. app-marketplace is the sharpest case: it ships the full flash-prevention machinery and a `.dark` stylesheet but only `getItem('letbuyy_theme')` (`layout.tsx:104`) with zero `setItem` and no toggle — so its dark mode is only reachable if *another* app on a shared origin happens to set that key.

**Recommended canonical direction.** Ship the shared `LetbuyyThemeProvider` (THEME-2) with a standard toggle slot, and make "expose theme toggle" a design-system checklist item every app satisfies. Decide deliberately which surfaces are theme-locked (e.g. operations) vs user-choosable.

---

### LDM-2 — Three persistence keys, two value vocabularies — preference does not travel
**Severity: High** · **Affected: identity-platform, merchant-control-plane, app-marketplace, marketing-site, theme-marketplace**

**Root cause.** Independent controllers chose independent storage. `letbuyy_theme` (identity/merchant/app-marketplace, values `dark`/`light`), `theme` (marketing-site, `light`/`dark`/`system`), `theme-marketplace-theme` (theme-marketplace, `light`/`dark`/`system`). A merchant who picks dark in the control plane and then visits the app marketplace or theme marketplace gets a different (or default) appearance.

**Code evidence.** `merchant-control-plane`/`identity-platform` write `letbuyy_theme`; `marketing-site/ThemeProvider.tsx` writes `theme`; `theme-marketplace/theme-provider.tsx` writes `theme-marketplace-theme`.

**Recommended canonical direction.** One key (`letbuyy-theme`), one vocabulary (`light|dark|system`), set on a shared cookie/origin where the apps share a parent domain so the choice follows the user across properties.

---

### LDM-3 — Class-vs-attribute signal divergence
**Severity: Medium** · **Affected: marketing-site (attribute) vs identity/merchant/app-marketplace/theme-marketplace (class)**

**Root cause.** The token CSS honors both `.dark` and `[data-theme="dark"]`, so both "work," but the platform has no single convention. This makes shared components, snippets, and future global CSS ambiguous about which signal to read.

**Code evidence.** `marketing-site/ThemeProvider.tsx` sets `data-theme`; the others toggle `.dark`.

**Recommended canonical direction.** Standardize on one (recommend `data-theme` on `<html>` driven by the provider) and have `DesignSystemRoot` mirror it.

---

### LDM-4 — Where dark "works," it works unevenly because apps re-author tokens
**Severity: High** · **Affected: merchant-control-plane (most fragile), app-marketplace, identity-platform**

**Root cause.** To survive THEME-1, apps re-declare dark tokens themselves rather than letting the engine flip. `app-marketplace/globals.css:115-144` redefines `--lb-color-*` under `.dark`; `identity-platform` uses app-local `--bg`/`--text-primary`; `merchant-control-plane` maps app-local aliases *from* `--lb-color-*` (e.g. `--header-bg: var(--lb-color-text)`), which on a light-OS machine reads light-theme source tokens inside the DS div — so a `@letbuyy/ui` component and an app-CSS region can disagree within the same screen.

**Code evidence.** `app-marketplace/globals.css:115-144`; `merchant-control-plane/globals.css` `--header-bg`/`--sidebar-*` mappings.

**Recommended canonical direction.** Fix THEME-1 (drive `DesignSystemRoot theme` from resolved value), then delete the app-level `.dark` token re-declarations so one engine governs both DS components and app CSS.

---

### LDM-5 — Mobile (Flutter) has the best dark mode but it's built on a forked palette
**Severity: Medium (parity) / High (governance)** · **Affected: apps/mobile/merchant-app**

**Root cause.** The Flutter app has full `light()`/`dark()` `ThemeData` (`store_theme.dart:13,278`, `useMaterial3: true`), `ThemeMode.system/light/dark`, a user toggle (`settings_screen.dart:427`), and persistence via `shared_preferences` (key `app_theme_mode`, default **dark**, `theme_provider.dart:9,57`) — genuinely the most complete theming in the platform, including a bespoke glassmorphism dark elevation ramp (`dark_theme_colors.dart`). **But** it is powered by a hand-maintained `AppColors` palette whose semantic colors diverge from web (`success #A4E500` vs `#22C55E`; `error #B02525` vs `#EF4444`), not the in-sync generated tokens (see `DESIGN_TOKEN_AUDIT.md` TOK-4, `COMPONENT_DUPLICATION_REPORT.md` §Mobile). Brand purple matches, so chrome looks right; status colors don't.

**Code evidence.** `store_theme.dart:13,278`; `theme_provider.dart:9,28,57`; `app_colors.dart:92,96` vs `tokens.ts:90,103`.

**Recommended canonical direction.** Keep the Flutter dark-mode UX (it's good); repoint its color source at the generated tokens and reconcile `AppColors` semantics, so light *and* dark render the canonical brand+status colors.

---

## 3. Dark-mode readiness scorecard (component of the master scorecard)

| Dimension | Rating | Basis |
|---|---|---|
| Engine dark-mode capability | **4.5 / 5** | Full light/dark/auto emission, reduced-motion, surfaces. |
| User reachability (web) | **2.0 / 5** | 4/9 apps; 1 hardcoded; 1 dead-ended. |
| Persistence consistency | **1.5 / 5** | 3 keys, 2 vocabularies, no cross-app carry. |
| Correctness where present | **2.5 / 5** | THEME-1 cascade; app token re-authoring. |
| Mobile dark mode | **3.5 / 5** | Excellent UX on a forked palette. |
| **Dark-mode readiness (overall)** | **2.0 / 5** | Capability ≫ delivery. |

See `THEME_ARCHITECTURE_AUDIT.md` for the engine mechanics and `DESIGN_SYSTEM_MASTER_AUDIT.md` for the consolidated scorecard.
