# PHASE L3 — THEME COMPILER (portable JSON → Liquid bundle)

**Program:** Full Liquid V1 · **HEAD:** `0b8a56e7` · plan-only. **Longest single build; on the critical path only if merchant Liquid editing must ship by Open Beta — otherwise a parallel branch.**

1. **Purpose.** Let the merchant editor persist edits as a Liquid bundle (today it emits portable JSON only; there is no compiler), so theme authoring (L13) and section depth become real for Full Liquid.
2. **Repository Reality.** The editor publish path emits portable JSON (`editor/page.tsx` `buildDraftConfig:581-618`); the routes accept a `liquidBundle` (`editor/route.ts:29-40`, `editor/draft/route.ts:27-34`) but the UI never sends one. **No portable→Liquid compiler exists** (grep: only the reverse, `buildLiquidRuntimeSectionSchemas` `theme-bundle.ts:1206-1272`).
3. **Current State.** Liquid bundles are hand/fixture-authored (`createLiquidParitySectionFiles`); merchant edits cannot become Liquid.
4. **Target State.** `compilePortableToLiquidBundle(templateConfig) → LiquidThemePackageBundle` (sections record + per-section `.liquid` with `{% schema %}` + layout + `templates` map); 20 sections deepened toward React parity.
5. **Files To Modify.** `packages/theme-engine/src/theme-bundle.ts` (section depth); `packages/theme-engine/src/index.ts` (export).
6. **Files To Create.** `packages/theme-engine/src/portable-to-liquid.ts` (the compiler).
7. **Files To Delete.** None.
8. **Dependencies.** L1 (bundle shape), L2 (CSS classes the sections emit).
9. **Validator Impact.** Compiler output must pass `LiquidThemePackageBundleSchema` (`:429-502`); `theme-governance-validator` parity (20 sections); `no-new-react-sections` unaffected (no React added).
10. **Migration Impact.** None.
11. **Testing Requirements.** Compiler round-trip (portable → liquid → renders the same sections/settings); golden-bundle test per section; fuzz invalid inputs reject cleanly.
12. **Performance Requirements.** Compilation is build/publish-time, not request-time → no storefront latency impact; cap compile time and output size (parse/memory limits).
13. **Security Requirements.** The compiler MUST emit schema-valid Liquid only — no `<script>`/`{% render %}`/`{% include %}`/`{% layout %}`; merchant-authored strings escaped via the section `{% schema %}` setting types, never raw-injected.
14. **Tenancy Requirements.** Compilation operates on a single store's `template_config` (tenant-scoped); output written via the existing tenant-scoped publish adapter.
15. **Identity Requirements.** N/A.
16. **Money Requirements.** N/A.
17. **Rollback Plan.** Stop wiring the compiler into the editor (L13); imported Liquid themes still render; authoring reverts to portable JSON.
18. **Success Criteria.** A portable template compiles to a valid Liquid bundle that renders the edited sections identically.
19. **Exit Criteria.** Round-trip + golden tests green; schema-valid output; compile within limits.
20. **Evidence Requirements.** The compiler + tests; a before/after render proving parity of a compiled bundle vs the portable source.
