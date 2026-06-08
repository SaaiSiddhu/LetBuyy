# Navigation

The canonical navigation system lives in **`packages/typescript/ui/src/navigation`**, re-exported from `@letbuyy/ui`. Apps must not hand-roll admin sidebars.

## Primitives
- `AppFrame` — page frame: `sidebar` slot + `topBar` slot + `<main>`. Token-driven (`--lb-color-bg/header/border`).
- `Sidebar` — `<aside>` with header/footer slots and a `width` scale (`sm 220 / md 260 / lg 320`). **One width scale — no `w-72`/`w-56`/`w-64` literals.**
- `Navigation` — renders a `NavigationItem[]` list with built-in active state (`aria-current="page"`, active background), hover, badge, icon sizing, focus ring.
- `AppNavigation` — data-driven shell that composes `AppFrame + Sidebar + Navigation` from a `sections` array and the current `pathname`, computing active state for you. This is the recommended entry point for admin/operations apps.

## Usage
```tsx
import { AppNavigation } from "@letbuyy/ui";

<AppNavigation
  pathname={pathname}
  brand={<Brand/>}
  sections={[{ items: [
    { id: "home", label: "Home", href: "/", icon: <…/> },
    { id: "orders", label: "Orders", href: "/orders", badge: 3 },
  ]}]}
  topBar={<HeaderBar/>}
>
  {children}
</AppNavigation>
```

`AppNavigation` derives `active` from `pathname` (exact + nested match), so apps stop re-implementing five different active-state strategies.

## Migration status
- ✅ `platform-console`, `platform-operations-portal` — migrated to `AppNavigation` (their `_local-ui` sidebar/workspace twins removed).
- ⏳ `merchant-control-plane` and remaining apps — tracked in `DESIGN_GOVERNANCE_RECOVERY_REPORT.md` and `docs/governance/skipped-human-decisions.md`.

## Rules (enforced direction)
- Admin/operations sidebars must use `AppNavigation`/`Sidebar`+`Navigation`.
- Active state comes from `item.active` / `AppNavigation`, never an ad-hoc `pathname ===` per app.
- Nav chrome colors use `--lb-color-*` (no hardcoded rgb in headers).
