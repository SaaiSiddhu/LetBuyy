# Unified storefront discovery — migration 386

One canonical `StorefrontDiscoveryQuerySchema` serves all ten theme families. Gateway products, products by store ID, product subsets, assigned collections and signed theme-preview product pages call only `browse_storefront_products_v1`. The old migration383 apparel RPC delegates to it. Existing inactive search-index/pooled/REST helper definitions are not called by the listing function. No new table, runtime, SQL extension, RLS bypass or anonymous function grant was added. This follows ARCH-R8, WIN-R4, CODE-R2 and AUTH-R1.

## Qualified result

Owned run `0d6117b8e98f`: **11 tests passed, zero failed/skipped/cancelled**, PostgreSQL16 + real PostgREST + mounted gateway Worker. The baseline replay ends at385, explicitly excludes387/388, then applies the exact386 draft. Every baseline filename, prefix and SHA256 is in `owned-db-run.json`; source hashes and cleanup are summarized in `qualification.json`. The production UP/DOWN files are byte-identical copies of the qualified drafts. All owned containers, networks and volumes were removed; held UI and developer fixtures were not touched. No hosted migration or deployment occurred.

Coverage includes nine product and five variant schema guards; malformed whole namespaces and hostile query types; one AVAILABLE relational variant satisfying all combined option/fact/price predicates; normalized physical units; distinct electronics power roles; toy, food, furniture, gifts, personalization, beauty, sports and book facts; stable ordered paging and past-end totals; actual scoped facet counts; tenant/collection ownership; anonymous refusal; positive-first app_tenant RLS; mounted public products/by-store/collection and real minted private preview; forged preview refusal; published-store gating; sanitized database outage; native function profiles; exact383 restoration; product-data conservation;388-column rollback refusal; forward replay.

Product base prices remain unchanged. Safe page metadata explicitly names matching available variant IDs and the corresponding minimum matching price. No price, compatibility or factual claim is inferred from image/SKU labels. Product list output continues through the canonical allowlisted public projection and the existing385 variant hydration.

Migration386 DOWN refuses a later388 carts.fact_acceptance_version column or active388 product writer, and never uses CASCADE. Later PL/pgSQL dependencies must retire first. Thirteen finite invoker-only helper/reader profiles include body hash, owner, argument names/default expressions, volatility, language, strictness, search_path and effective execution grants.

## Source and validation

- Canonical schema: packages/commerce-core/src/storefront-discovery.ts; apparel query is a compatibility alias.
- Gateway adapter: services/api-gateway/src/lib/storefront-discovery.ts.
- SDK: storefront listProducts/listProductsByStoreId/themePreviewProductPage preserve optional discovery metadata; generic pagination remains unchanged. Signed collection singleton and install expectations/receipt types use existing routes. Supported headers/signal are preserved; no-store belongs to the existing app fetch wrapper.
- `pure-contract.log`:10/10 core and gateway contract checks.
- `sdk-contract.log`:3/3 real SDK transport checks.
- `runner-selection.log`:2/2 migration ceiling option/selection checks. Omitted ceiling retains all-migration behavior.
- `adjacent-contracts.log`:25/25 existing product leak/tenant/projection, public route, cache and private-preview SDK checks. The test-only fake now returns the canonical discovery envelope and F5 asserts exact p_query forwarding.
- `runner-governance.log`:23/23 checks, including the explicit owned-suite inventory. Seven actual new suite names were added without changing any gate assertion.
- Core, SDK and Gateway noEmit checks pass in their respective typecheck logs.
- `build-static-guards.cjs` is an authoring-only finite schema compiler. It generates static SQL predicates, not a runtime JSON Schema interpreter. `canonical-schemas.json`, `leaf-source-hashes.json` and `function-profiles.json` pin its inputs/profiles. Avoid editing generated predicates by hand; review authored custom refinements in discovery-tail.sql.

## Failed attempts retained

Attempt01 run33d99b4415ca failed before SQL execution because psql -c exceeded the operating system per-argument limit. The test now uses the existing reviewed owned.script stdin path. Attempt02 run2f44dd5a1a08 caught an ambiguous alias in the admission guard and rolled back. Attempt03 run9c7df50abee7 passed9/11: the RLS assertion incorrectly selected the trailing ROLLBACK tag, and an actual Core editor roundtrip integration defect prevented preview minting. Its full log/report are retained. The parser now selects actual numeric row output. The final preview test saves a small valid header template through the real merchant endpoint; production validators were not weakened.

The independent Core defect remains owned by the coordinator/Editor: fresh through385 synthetic site, theme_id=letbuyy-core; signed GET /v1/themes/letbuyy-core/editor?store_id=SITE returns a template that PUT /v1/themes/letbuyy-core/editor/draft rejects with400. Header rejects logoUrl/displayMode/showAccount/navPlacement/logoPlacement; footer rejects columns/showLogo/showSocial/copyrightText/showNewsletter/showPaymentIcons; themeSettings rejects isDark/fontFamily/enableShadows/enableAnimations. Actual failed-response runtime schema_source and template bytes were not captured. See attempt03.log; do not treat the isolated discovery pass as proof of Core roundtrip correctness.

Frontend compositor and all-theme rendering integration is owned by Trailmark and the common demo layer by Marketplace. Their final validation belongs to the programme evidence; this record does not claim a full application build or production rollout.
