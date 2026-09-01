# PHASE L13 — THEME AUTHORING (+ Publishing)

**Program:** Full Liquid V1 · **HEAD:** `0b8a56e7` · plan-only. **Deferrable if Open Beta ships one fixed Liquid theme.**

1. **Purpose.** Let a merchant author, preview, and publish a Liquid theme via the editor (so theme settings/customization persist as Liquid, not portable JSON that strips the bundle).
2. **Repository Reality.** The editor emits portable JSON; routes accept `liquidBundle` (`editor/route.ts:29-40`, `editor/draft/route.ts:27-34`) but the UI never sends one; preview is the real storefront `/preview` (always React today because no bundle). Publish writes `theme_releases.template_snapshot` + `sites.template_config` (`theme-execution.adapter.ts:634,765`). No Liquid code editor exists.
3. **Current State.** Authoring/preview/publish are React/portable-JSON only; editing an imported Liquid theme strips the bundle (engine desync).
4. **Target State.** Editor calls the L3 compiler on publish/draft and includes `liquidBundle`(+`liquidRenderingCanary`); preview renders Liquid; an engine guardrail prevents desync.
5. **Files To Modify.** `apps/merchant-control-plane/.../editor/page.tsx` (`buildDraftConfig:581-618`, `handlePublish:1048-1052`, `saveDraft:928`); `editor/route.ts`, `editor/draft/route.ts` (consume the bundle they already accept); preview wiring (`CenterPanel.tsx`, storefront `/preview`).
6. **Files To Create.** None (compiler is L3).
7. **Files To Delete.** None.
8. **Dependencies.** L3 (compiler), L1-L12 (template shapes to compile to).
9. **Validator Impact.** Output via `LiquidThemePackageBundleSchema`; `theme-governance-validator` parity; the publish path already validated by existing theme-execution tests.
10. **Migration Impact.** Migration `087_theme_template_drafts.sql` already supports non-index drafts (`theme-execution.adapter.ts:965`); confirm applied.
11. **Testing Requirements.** Edit→publish emits a valid Liquid bundle that renders the edited sections; preview renders Liquid; desync guardrail blocks a portable-only publish over a Liquid store.
12. **Performance Requirements.** Compile + publish are admin-time, not storefront-time; preview latency acceptable (it loads the real storefront).
13. **Security Requirements.** Merchant-authored content compiled to schema-valid Liquid only (no script/render/include); the publish path is auth-gated (merchant owner); preview token-scoped (`theme_preview_token`).
14. **Tenancy Requirements.** Editor scoped to the merchant's store; publish writes tenant-scoped `theme_releases`/`sites` (RLS ENABLE); preview token bound to the store.
15. **Identity Requirements.** Merchant session (ES256, identity-platform) gates the editor — unchanged; no customer/issuer involvement.
16. **Money Requirements.** N/A.
17. **Rollback Plan.** Stop emitting `liquidBundle` from the editor → portable-JSON authoring; imported Liquid themes still render. No data loss.
18. **Success Criteria.** A merchant edits a Liquid theme, previews it as Liquid, and publishes it live as Liquid.
19. **Exit Criteria.** Editor-emits-bundle + preview-Liquid + desync-guard tests green.
20. **Evidence Requirements.** An edit→publish→render trace producing Liquid; the desync guardrail test; preview screenshot rendering Liquid.
