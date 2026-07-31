# Stream E — Theme Editor Integration — Report

**Status:** 📋 SPEC-READY (engine done; UI wiring deferred — see rationale)

## Why deferred (not fabricated)
The editor page (`apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`, ~1898 lines) is **pre-existing WIP-modified** and is design-system-ratcheted `apps/` TSX. A picker UI cannot be visually verified without the full local stack (gateway + storefront + Supabase + a store). Shipping unverifiable TSX into a WIP-modified file would risk bundling unrelated WIP and a ratchet regression. The **engine it needs is complete and tested**; the wiring is a small, well-specified client change.

## Ready-to-apply integration (no new gateway route, no DB change)
The editor already auto-saves drafts: `applyChange()` (page.tsx:761) → `isDirty` → 900ms debounce → `syncPreviewDraft()` (943) → existing `POST /api/themes/[id]/editor/draft`. An experience apply is a pure client-side merge that rides this path.

1. Import the engine (already a workspace dep): `import { listExperiences, getExperience, applyExperienceToTemplateConfig } from '@letbuyy/theme-engine'`.
2. Add an **Experience picker** into the settings panel (`panelMode === 'settings'`, ~line 1393) — render `listExperiences()` as cards using each `experience.preview` (label + `swatches` + `sectionCount`). Use `@letbuyy/ui` components / `--lb-*` tokens only (no inline hex) to satisfy the design-system ratchet.
3. Add the apply handler:
   ```ts
   const applyExperience = useCallback((id: string) => {
     const exp = getExperience(id); if (!exp) return;
     applyChange((current) => ({
       ...current,
       themeSettings: { ...current.themeSettings, ...exp.tokens /* via buildExperienceSettingsOverlay */ },
     }));
   }, [applyChange]);
   ```
   (Or merge `buildExperienceSettingsOverlay(exp)` directly.) `applyChange` flips `isDirty` → preview refreshes → publish works unchanged.
4. **Preview** is automatic (the existing preview-session token refresh). **Publish** is unchanged.

## Acceptance the wiring must meet
- Picker lists all 10 experiences with live color swatches.
- Selecting one updates `themeSettings`, auto-saves the draft, and the preview iframe reflects the new tokens.
- Publish promotes the draft via the existing `publish_theme_release` RPC.
- No new React section, `--lb-*` tokens only, no design-system ratchet regression.
