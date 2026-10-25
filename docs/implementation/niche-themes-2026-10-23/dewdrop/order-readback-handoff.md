# Historical order readback handoff

The authorized buyer gateway projection, private BFF, Liquid order drop, buyer fallback page and merchant order page now render validated historical niche facts from the canonical saved envelope. Exact saved option tuples appear for every niche, including names with spaces and Unicode. No current-product query or alternate snapshot writer is used.

The source lease is released for coordinator review and integration after the recorded checks below. No database, browser, server, full build, migration, commit, push, merge or deploy was performed during this readback allocation. The earlier Dewdrop screenshot session is separate and remains closed.

## Actual source path

1. MadeYours owns `product_snapshot.niche` persistence and the canonical `normalizeOrderItemRecord` implementation in `packages/checkout-core/src/index.ts`. The public `readProductFactSnapshot` reader/type live in `@letbuyy/commerce-core`. This allocation consumes those contracts without changing their writer, DTO, package indexes or migration 388.
2. `services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts` keeps its existing buyer-link/site authorization, database loader and common hydration. Its order-item allowlist now calls `services/api-gateway/src/lib/buyer-order-item-view.ts`. That helper extracts the validated envelope through the actual normalizer from immutable `product_snapshot.niche`; an arbitrary raw `item.niche_snapshot` is not accepted at this source boundary. Raw product snapshots, cost and supplier metadata stay private. Existing display/money fields retain the same allowlist.
3. `apps/commerce/web/src/app/api/buyer/orders/route.ts` retains the existing session, signed-site, no-store and GET/POST behavior. Each detail item adds only a successfully parsed approved `niche_snapshot`. It never falls back to a raw product snapshot.
4. `apps/commerce/web/src/lib/order-fact-readback.ts` reads only the approved field, maps exact `selected_options` into a plain map, and builds bounded scalar `niche_facts_text` through the existing shared formatter. This survives the unchanged Liquid depth/key scrub. Text uses ordinary escaping, never `raw`.
5. `apps/commerce/web/src/lib/customer-drop.ts` adds the scalar field to actual order lines. Canonical saved options take precedence in the existing `variant: Record<string,string> | null` field. For legacy receipts, only an existing flat string variant map is retained as a fallback. The canonical normalizer's saved `title` is supported alongside `name`. The existing Threadline money/status fixes are preserved and their regression tests pass. `buyer-order-drop.ts` needs no edit: its existing delegation to `mapOrderDetailDrop` inherits this projection.
6. `summarizeProductFacts` adds a presentation-only `selected-options` section. It preserves the exact saved name/value tuples for all nine niches; a supplied option label such as `Pack size: 250 g` does not become a domain net-quantity fact. Missing facts remain unknown. Own string values are bounded; inherited/accessor values are ignored. This is presentation, not a new snapshot or order DTO.
7. The mounted buyer fallback `order-detail-client.tsx` reads the approved envelope and renders the existing thin `NicheOrderFacts` component below the unchanged receipt row. The mounted merchant order page uses the new `components/orders/order-line-items.ts` pure mapper and its host wrapper. Both use saved facts, accepted personalization and exact saved options. Current-product deletion/change cannot select new facts.
8. `packages/theme-engine/src/niche-order-presentation.ts` is a pure opt-in decorator for exactly the nine approved niche `2.0.0` packages. It injects native details and the scalar text into each canonical customer order line. The coordinator already owns/applied its nine-factory builder registration. Core, Threadline, v1 defaults, later versions and persisted release bytes are excluded; root owns final release hashes/freeze/promotion.

The actual `@letbuyy/api-client` orders call preserves the parsed envelope through its existing unwrap path; it does not run a schema that strips the field. The focused SDK test proves this, so no SDK/shared-types/index edit was necessary. Gift content summaries and existing saved primary-image fields retain their current contracts. No role-based image URL is inferred from numeric media-role indexes or today's catalog, and no images-array DTO was added.

## Independent roundtrip defect fixed

Habitat's real prepare → normalizer → mapper → Liquid oracle exposed saved furniture/food options that existed in the envelope but did not reach the receipt. The previous mapper inspected only `item.variant`; the generic formatter emitted option context only for beauty. The fix projects canonical saved options into the existing map and the scalar shared summary.

The regression now checks `Finish`, `Seat size`, `आकार` and `Pack size`, conflicting legacy values, a positive saved item title, actual rendered Liquid output and unknown net quantity. No Liquid key, sandbox, depth or escaping rule was relaxed. Both React host wrappers also check exact saved option labels and Unicode values.

## Verification receipt

Run from repository root:

```sh
node docs/implementation/niche-themes-2026-10-23/dewdrop/order-readback-verify.cjs
```

`order-readback-verification.json` records exact argument arrays, working directories/environment, exit codes, source/dependency SHA-256 values and source stability during the run. The final run passed 132 tests with zero failures/skips:

| Cohort | Tests |
| --- | ---: |
| Existing buyer order route tests, new gateway item view and approved reader | 17 |
| Actual private BFF handler, actual order mapper/Liquid and existing money/status regressions | 12 |
| Existing buyer proxy suite, including GET/claim/session/sanitization behavior | 69 |
| Actual mounted buyer order page and buyer-switch denial | 3 |
| Actual merchant SDK unwrap, mounted page and denied store read | 3 |
| Shared facts formatter and both semantic host wrappers | 17 |
| Pure opt-in helper plus actual catalog/version cohorts | 11 |

Five no-emit checks pass: focused commerce/merchant configs extending each actual app config, plus full commerce-core, API-gateway and theme-engine package configs. Focused commerce/merchant ESLint checks pass with zero errors; merchant has one pre-existing unused `Banner` import warning. Targeted `git diff --check` is clean. No passing gate here is described as a full build.

The prior 34-test Dewdrop module/editor/collection/render qualification and its 18 screenshots remain under `verification.json`/`browser-audit.json`. The earlier 16-test pure formatter/wrapper receipt remains under `order-facts-verification.json`; the final current formatter/wrapper cohort is 17 tests, including the new generic saved-option regression. Those receipts are separate and are not added together as unique coverage.

## Limits and remaining acceptance

The query-shape test uses the real tenant-guarded client and real buyer ownership loader against fake PostgREST. Mounted components use real app components, hooks and Next contexts against synthetic responses. Product mutation/deletion is simulated in fixture objects. Actual Liquid is rendered with a synthetic valid buyer and positive saved item-title assertions; missing/unavailable buyers hide the facts. These are useful in-process checks, not database/RLS or production-worker route acceptance.

Root's owned database/purchase-flow acceptance must still prove authorized saved fact capture, relational hydration, buyer/site/merchant denial, order creation/reload and historical preservation after actual product changes/deletion. Shared editor lifecycle, discovery/cart selection, immutable release freeze/promotion and public browser qualification remain with their assigned owners. Habitat owns the independent prepared-snapshot roundtrip receipt. No completed durable purchase or payment is claimed here.

## Governance

This extends the canonical winner rather than creating a second writer or lookup (`WIN-R4`, `WIN-R6`, `ARCH-R15`). The gateway item projection stays inside the existing identity and tenant chain (`ARCH-R17`, `ARCH-R18`); facts do not grant access or become price authority (`CODE-R6`). Missing legacy or malformed approved envelopes show a short unavailable message. Known monetary/status logic and raw metadata protections remain intact. The final tenant/order acceptance remains explicitly open under the applicable gateway real-worker/owned-database test rules.
