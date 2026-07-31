# PHASE L2 — LIQUID ASSET PIPELINE (CSS)

**Program:** Full Liquid V1 · **HEAD:** `0b8a56e7` · plan-only.

1. **Purpose.** Make Liquid pages styled — today the Liquid layout ships no CSS, so a Liquid store renders structurally correct but unstyled.
2. **Repository Reality.** Liquid layout has no `<style>`/`:root`/stylesheet (`theme-bundle.ts:1819-1835`); `renderer.assets` schema supports `stylesheet` entries (`:209-214`) but fixtures are `{}`; `asset_url` returns `/assets/<file>` (`theme-renderer.ts:638`) with **no serving backend**; DOMPurify strips inline `style` (`:157`) → styling must be class-based. The `lb-*` CSS already exists, fully authored, in React `globals.css:554-710` (plain CSS + CSS vars, not `@apply`) → portable by extraction.
3. **Current State.** Styling only exists for React (per-store `:root` `<style>` in `layout.tsx:126-160` + Tailwind). Liquid: none.
4. **Target State.** Liquid layout emits a theme `:root` token block (from `config.settings_data.current`) + a served `lb-*` stylesheet `<link>`; pages render styled.
5. **Files To Modify.** `packages/theme-engine/src/theme-bundle.ts` (layout source + `renderer.assets`); `packages/theme-engine/src/theme-renderer.ts` (inject `:root` + `<link>`; verify `<style>`/`<link>` survive `WHOLE_DOCUMENT` DOMPurify `:287`).
6. **Files To Create.** Extracted stylesheet (e.g. `packages/theme-engine/assets/urban-kicks.css` = `globals.css:554-710` + ~10% new for `lb-spotlight`/`lb-badge`); an `/assets/[file]/route.ts` storefront route or an R2 binding + resolver.
7. **Files To Delete.** None.
8. **Dependencies.** L1.
9. **Validator Impact.** `theme-governance-validator.mjs:88-97` (sanitizer must stay DOMPurify + `outputEscape:'escape'` — do not regress); `cloudflare-binding-validator` if an R2 binding is added.
10. **Migration Impact.** None (no DB) unless assets are stored in DB (not recommended — serve static/R2).
11. **Testing Requirements.** Render test: layout emits a `:root` block with the store's tokens AND a stylesheet `<link>` that survives sanitization; a structural snapshot of a styled section vs the React baseline.
12. **Performance Requirements.** Stylesheet served with long cache headers (immutable, hashed filename); single `<link>` (no per-section CSS); must not break ISR `revalidate=60`; keep added head size minimal.
13. **Security Requirements.** Critical — `content_for_header` is `| raw`-injected (`theme-renderer.ts:280,344`); the `<link>`/`<style>` injection must be theme-controlled, not user-content; confirm DOMPurify in `WHOLE_DOCUMENT` mode does not strip the head `<style>`/`<link>` (adjust `ADD_TAGS` if needed without weakening the tag/attr forbid-list).
14. **Tenancy Requirements.** The stylesheet is theme-global (not per-tenant data); the `:root` tokens are per-store from `template_config` (tenant-scoped read). No new tenancy surface.
15. **Identity Requirements.** N/A.
16. **Money Requirements.** N/A.
17. **Rollback Plan.** Revert the layout/asset changes → pages render unstyled (current state). No data.
18. **Success Criteria.** A canary store renders a **styled** Liquid home (tokens applied, `lb-*` resolved, fonts loaded).
19. **Exit Criteria.** Styled-render test green; sanitizer validator green; asset served with correct cache headers.
20. **Evidence Requirements.** Screenshot/structural diff of a styled Liquid section; the served stylesheet URL + headers; the passing sanitizer test.
