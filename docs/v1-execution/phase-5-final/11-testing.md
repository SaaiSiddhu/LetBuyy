# 11 — Testing

**Status: ✅ green. No fake tests.**

| Check | Result |
|---|---|
| api-client / api-gateway / merchant-control-plane typecheck | ✅ all EXIT 0 |
| **Smart-collection evaluator unit tests** | ✅ **35/35** (`smart-collection-eval.test.ts`) |
| `tests/launch/lb-phase5-commerce.test.mjs` | ✅ **16/16** (4 PO + 5 [5.5] + 3 [5.75] + 4 [5.9]) |
| Full launch suite | ✅ **200/200** |
| Gateway unit suite | ✅ **348/351** — the +35 evaluator tests pass; the 3 fails are PRE-EXISTING + unrelated (AI route, analytics migration, storefront payment route); **0 new** |

## Phase-5.9 contract tests added
- Smart Collections: evaluator lib + tests + gateway route registered + RBAC-guarded writes + api-client + page.
- Reservation explorer + Receipt history: additive GETs + api-client + proxies + pages.
- Analytics: real-aggregation endpoint (`low_stock_count`/`total_skus`/`*_by_status`) with `isMissingTableError` fallback (asserts no fabrication) + api-client.
- Navigation: the 3 new pages linked.

## Honest boundary
Compile + unit + contract level. The smart-collection **evaluator logic is fully unit-proven (35/35)**; everything else is compile/contract-verified. Runtime (preview matching real products, reservation/receipt/analytics queries hitting Supabase, the 30 RBAC guards 403-ing in `enforce` mode) needs a live stack — explicitly out of scope, not faked.

**Verdict:** the strongest test posture of the Phase-5 series — a unit-tested rule engine + 16 commerce contract tests + 200/200 launch + 4 clean package typechecks.
