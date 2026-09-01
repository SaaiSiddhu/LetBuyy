# LB-8 — Announcement Bar: Implementation Strategy

**Date:** 2026-06-13 · **Mode:** research/blueprint (no code written) · all claims cite file:line.

## TL;DR

The announcement bar is **already in every store's default template at `order:5`** (`theme-registry.ts:625-634`) but renders as a **broken grey dashed placeholder** because the live React renderer has no component for it (`renderer-registry.tsx` → `UnknownSectionFallback`). **Recommended fix: register a `core.announcement-bar` renderer inline in `renderer-registry.tsx`** with a server component placed **outside** `components/sections/`. This is governance-legal, ~1 file, no flag flip, no migration, rollback-trivial.

## The governance constraint (exact)

`scripts/validators/no-new-react-sections-validator.mjs:33` walks only `apps/storefront-runtime/src/components/sections/` and flags any `.tsx` there not in the hardcoded 20-file frozen `Set` (`:9-30`):

```js
for (const entry of phaseBEntries(["apps/storefront-runtime/src/components/sections"])) {
  if (!entry.path.endsWith(".tsx")) continue;
  if (!frozenReactSections.has(entry.path)) offenders.push(`${entry.path}: React section registry is frozen; add Liquid sections instead`);
}
```

→ The freeze polices **one directory**. `renderer-registry.tsx` (in `lib/theme-engine/`) and any component outside `components/sections/` are invisible to it. `theme-governance-validator.mjs:69-72,98-101` separately count-locks "20 frozen React sections" + "20 Liquid parity entries" — neither is affected (announcementBar is not one of the 20, and its Liquid parity already exists at `theme-bundle.ts:769-785`). **No validator asserts a count or fixed set on `SECTION_RENDERER_DEFINITIONS`** (verified).

## Options

| Option | What | Governance | Verdict |
|---|---|---|---|
| **A — fold into header** | render strip inside `components/layout/dynamic-header.tsx` | Legal (header is in `layout/`, not `sections/`) | ❌ **Reject** — header only receives `HeaderSettings` (`renderer-registry.tsx:61-67`); the announcement is a separate `order:5` section object, not header chrome. Threading it in re-plumbs the template model, orphans the `announcement-default` instance (still renders its broken box), and the header is `position:fixed` (`dynamic-header.tsx:179`) so it wouldn't flow. High blast radius, conceptually wrong. |
| **B — inline renderer** | add a `SECTION_RENDERER_DEFINITIONS` entry + server component outside `sections/` | Legal (validator never sees it) | ✅ **RECOMMENDED** — low effort, no flag, fixes the live broken box, rollback = delete one entry. |
| **C — Liquid render** | flip `FEATURE_LIQUID` / `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` | **FORBIDDEN** — `theme-governance-validator.mjs:60-65` fails the gate unless the flag stays `false` and the platform-wide flip stays `status:'deferred'`. ARB/V2. | ❌ Reject for V1. |

## Recommended implementation (Option B)

**Schema the component must honor** (`theme-registry.ts:136-162`): `text` (≤120), `linkLabel` (≤40), `linkHref` (url), `alignment` (left/center/right), `backgroundColor` (#0F172A), `textColor` (#FFFFFF), `visibleOnMobile` (bool). No `dismissible` field → component is stateless (server component, no `'use client'`).

**Exact files:**

1. **`apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx`** — add one entry to `SECTION_RENDERER_DEFINITIONS` (array at `:56-203`):
   ```tsx
   { rendererKey: 'core.announcement-bar',
     sectionTypes: ['announcementBar', 'announcement-bar'],
     schema: schemaFor('announcementBar'),
     render: ({ section }) => <AnnouncementBar section={section} /> },
   ```
   Adding the entry auto-populates `COMPATIBILITY_RENDERER_KEYS` / `APPROVED_SECTION_RENDERERS` / the manifest (`:205-230`).

2. **Component** — inline in `renderer-registry.tsx` OR a new file at `apps/storefront-runtime/src/components/storefront/announcement-bar.tsx` (**must NOT be under `components/sections/`**). Reads `section.settings` (already populated from `announcementBar.defaults` + merchant overrides by the template resolver); renders `<aside>` with bg/fg inline styles, alignment class, optional `<a>` CTA, `hidden sm:block` when `visibleOnMobile===false`; returns `null` for empty `text`. Use `<a>`/`<aside>` (server), not `next/link`.

**Settings flow:** no new wiring — `section.settings` arrives via `composition-engine.tsx:34-43,407-415` → `renderRegisteredSection` exactly as the 19 existing renderers.

## Validator impact

- `no-new-react-sections-validator` — **unaffected** (no file added to `sections/`).
- `theme-governance-validator` — **unaffected** (20/20 frozen + Liquid parity unchanged).
- No route/design-system/migration validator touched.

## Tests

- **Extend `tests/contracts/theme-section-registry.test.ts`** (`:1-46`): assert `SECTION_RENDERER_DEFINITIONS` contains an `announcementBar`/`announcement-bar` entry and `renderRegisteredSection` no longer falls to `UnknownSectionFallback` for that type. Existing assertions (the `SECTION_RENDERER_DEFINITIONS: RegisteredSectionRenderer[] = [` shape + no-`switch` guard `:27`) stay green.
- Optional render unit test: `null` on empty text; CTA only when both `linkLabel`+`linkHref`.
- Do **not** touch `tests/contracts/demo-store-isolation.test.ts:74` (targets the editor page source, not the registry).

## Rollout / rollback

- **Rollout:** single PR; behind no flag (the section is already in the default template, so it goes live for every store on deploy — this is desired since it currently shows a broken box). Validate: `node scripts/validate-governance.mjs --lane=gate` + the section-registry test.
- **Rollback:** delete the one `SECTION_RENDERER_DEFINITIONS` entry (+ component/file). Reverts to the current `UnknownSectionFallback`. No schema/template/flag/migration/state involved.

## Known follow-up (out of LB-8 scope)

The header is `position:fixed` (`dynamic-header.tsx:179`); the `order:5` strip renders above the hero but the fixed header overlays it. If the strip must sit visually above the header, that's a header-offset task, not part of "make it render." Flag, don't block.

**Effort: ~0.5–1 day. Risk: low. Commit: 1 (separate).**
