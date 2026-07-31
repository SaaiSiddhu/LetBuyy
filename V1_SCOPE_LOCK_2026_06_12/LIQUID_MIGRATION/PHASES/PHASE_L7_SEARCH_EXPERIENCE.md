# PHASE L7 — SEARCH EXPERIENCE

**Program:** Full Liquid V1 · **HEAD:** `0b8a56e7` · plan-only. **The only phase with a genuine backend gap.**

1. **Purpose.** Render search results through a Liquid `search` template.
2. **Repository Reality.** Storefront search is **client-side filter only**; the `lb-search` island navigates to `?search=` (`liquid-hydration-islands.tsx`, `theme-bundle.ts:980`); the `/shop?search=` param is otherwise unused. The gateway `search` routes are internal-console/developer/domains only — **no public product-search endpoint exists**.
3. **Current State.** No real search; thin client filter; no Liquid search template.
4. **Target State.** A `search` Liquid template; a decision on the backend — (a) keep client-side filter (port to Liquid, lowest effort) or (b) add a real `GET /storefront/:sub/search?q=` product endpoint.
5. **Files To Modify.** `packages/theme-engine/src/theme-bundle.ts` (`search` template + results section); `apps/storefront-runtime/.../shop/page.tsx` (honor `?search=` if option a).
6. **Files To Create.** (option b) `services/api-gateway/src/routes/storefront/` search handler + an `/api/storefront/.../search` proxy (covered by the next.config rewrite, so no new local route).
7. **Files To Delete.** None.
8. **Dependencies.** L6.
9. **Validator Impact.** (option b) `domain-boundary-validator.mjs:209` route count if an app-API route is added (it is a rewrite-proxy, likely not counted — verify); schema.
10. **Migration Impact.** None (search over existing product tables; option b may add a trigram index — `084_trigram_search_indexes.sql` exists).
11. **Testing Requirements.** `?search=term` renders a Liquid results page; empty-result state; (option b) endpoint returns tenant-scoped products.
12. **Performance Requirements.** Search must be bounded (limit results, paginate); cache common queries; if option b, use the existing trigram index (`084_*`); render within limits.
13. **Security Requirements.** Query string escaped; no injection into Liquid/SQL (parameterized); rate-limit if a real endpoint is added.
14. **Tenancy Requirements.** Results scoped to the store (tenant); if endpoint added, RLS-governed product read by `site_id`.
15. **Identity Requirements.** N/A.
16. **Money Requirements.** Prices display-only.
17. **Rollback Plan.** Fall back to client-side filter / remove the `search` template key.
18. **Success Criteria.** A canary store's `?search=` returns a styled Liquid results page.
19. **Exit Criteria.** Search render test green; (option b) endpoint test green; search parity cells green.
20. **Evidence Requirements.** Rendered search results; the backend decision recorded; passing tests.
