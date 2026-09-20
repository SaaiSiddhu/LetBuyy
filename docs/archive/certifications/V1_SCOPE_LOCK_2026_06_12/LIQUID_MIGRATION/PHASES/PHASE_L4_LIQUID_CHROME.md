# PHASE L4 — LIQUID CHROME (Header / Footer / Navigation)

**Program:** Full Liquid V1 · **HEAD:** `140a73db` · plan-only.

1. **Purpose.** Make a Liquid page fully Liquid — today the layout renders React header/footer even over a Liquid body (CAP-C08) — and bind navigation menus into the Liquid header.
2. **Repository Reality.** `layout.tsx:214,224` renders React `StorefrontSectionGroupRenderer` for header/footer over ALL bodies, including Liquid; `theme-governance-validator.mjs:114` tracks the CAP-C08 gap. `navigation_menus` table exists (`000_baseline.sql:9855`, RLS ENABLE `:25148`) and is consumed by React `dynamic-header.tsx`. The Liquid header section fixture exists (`theme-bundle.ts:964-982`).
3. **Current State.** Liquid bodies wear React chrome; nav menus are React-only.
4. **Target State.** When the engine is Liquid, the layout renders Liquid header/footer; the Liquid header binds `navigation_menus`.
5. **Files To Modify.** `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx:214,224` (conditional Liquid chrome); `packages/theme-engine/src/theme-bundle.ts` (header/footer sections + nav binding); `apps/storefront-runtime/src/lib/store-service.ts` (surface nav-menu data into the render context if not already).
6. **Files To Create.** None (sections exist; extend them).
7. **Files To Delete.** None yet — React `dynamic-header.tsx` stays as KEEP-TEMP until L17.
8. **Dependencies.** L2 (chrome must be styled).
9. **Validator Impact.** `storefront-seo-access-validator.mjs:12` reads `layout.tsx` — keep SEO/access assertions satisfied; `theme-governance-validator:114` (CAP-C08) should flip to satisfied.
10. **Migration Impact.** None (nav data exists).
11. **Testing Requirements.** Liquid header/footer render with the store's nav menu; the React-chrome path still works when engine=react (parity during transition); SEO/robots/sitemap assertions unchanged.
12. **Performance Requirements.** Chrome is part of every page render — keep within `renderLimit 250`; nav-menu fetch must be cached (ISR) not per-request.
13. **Security Requirements.** Nav labels/URLs are merchant data → escaped via Liquid `outputEscape:'escape'`; URLs validated (no `javascript:` — `safeLiquidUrl` `theme-renderer.ts:633-640`).
14. **Tenancy Requirements.** `navigation_menus` is RLS-ENABLE, tenant-scoped by `site_id`; read via the existing tenant-scoped store fetch.
15. **Identity Requirements.** Header reflects auth state (cart/account links) via the customer session — read-only; no issuer change.
16. **Money Requirements.** Header cart count reads the shared `lb_cart` state; no money path.
17. **Rollback Plan.** Revert `layout.tsx` to always-React chrome (current behavior). Per-store canary off also reverts the whole page to React.
18. **Success Criteria.** A canary Liquid page shows Liquid header+footer with the merchant's nav menu, styled.
19. **Exit Criteria.** CAP-C08 satisfied; SEO validator green; chrome render parity test green.
20. **Evidence Requirements.** Rendered Liquid chrome with nav; the satisfied CAP-C08 check; SEO assertions passing.
