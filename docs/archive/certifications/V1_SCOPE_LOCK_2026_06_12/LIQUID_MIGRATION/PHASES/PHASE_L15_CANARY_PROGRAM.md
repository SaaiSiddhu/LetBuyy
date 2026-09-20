# PHASE L15 — CANARY PROGRAM

**Program:** Full Liquid V1 · **HEAD:** `140a73db` · plan-only.

1. **Purpose.** Flip Liquid on for a small, controlled set of real stores and soak before any platform default change.
2. **Repository Reality.** `resolveThemeLiquidRenderingEnabled` reads `liquidRenderingCanary` from `template_config`/`themeSettings`/`releaseManifest` (`theme-governance.ts:144-168`); `store-service.ts:655-657,706` surfaces it; `template-resolver.ts:229-233` gates the bundle on it. **No DB column, no writer, no operator endpoint** — the flag lives only in JSON, set by no product surface. Default `false`.
3. **Current State.** Canary readable but unsettable in production.
4. **Target State.** A per-store canary writer (template_config write, or a `sites.liquid_rendering_canary` column) + an operator endpoint; a cohort of N stores rendering Liquid in production with the platform default still off.
5. **Files To Modify.** `theme-execution.adapter.ts` (persist canary through `buildReleaseArtifacts`/store update); `store-service.ts:655`; an operator route (`internal-console`/`operations`).
6. **Files To Create.** Optional migration adding `sites.liquid_rendering_canary boolean default false`; an operator endpoint route.
7. **Files To Delete.** None.
8. **Dependencies.** L14 green (no flip without parity proof).
9. **Validator Impact.** `sequential-migration` if a column is added; `theme-governance-validator` default stays `false` (unchanged — canary is per-store, not the platform flip).
10. **Migration Impact.** Optional additive column (default false) — safe.
11. **Testing Requirements.** Setting canary flips one store to Liquid; non-canary stores stay React; unsetting reverts instantly; operator endpoint authz.
12. **Performance Requirements.** Monitor canary stores: render latency, error rate, ISR hit rate vs React baseline; alert on regression.
13. **Security Requirements.** The operator endpoint is platform-staff-only (console RBAC); canary cannot be set cross-tenant by merchants.
14. **Tenancy Requirements.** Canary is per-store (`sites`, RLS ENABLE); the writer is tenant-scoped or platform-operator-scoped.
15. **Identity Requirements.** Operator action gated by console session (allowlist + TOTP); no customer/merchant issuer change.
16. **Money Requirements.** Canary stores transact normally (cart/checkout unchanged); monitor order success rate as a money-safety signal.
17. **Rollback Plan.** **Instant** — set canary `false` → render-time revert to React, no redeploy. This is the program's primary live safety lever.
18. **Success Criteria.** A real pilot store renders full Liquid in production with clean metrics over the soak; default still off elsewhere.
19. **Exit Criteria.** Cohort soak clean (no P0/P1 render/money/auth); metrics ≥ React baseline; ready for L16.
20. **Evidence Requirements.** Canary soak report (`X-Lb-Render-Engine: liquid` traffic, error/latency/order-success metrics); the rollback drill result.
