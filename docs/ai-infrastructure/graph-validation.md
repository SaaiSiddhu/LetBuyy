# Graphify Query Validation

Executed against the freshly built `graphify-out/graph.json` (52,246 nodes / 66,761 edges).

| Domain | Query | Result | Status |
|--------|-------|--------|--------|
| Architecture | `graphify explain "create_checkout_order"` | Resolves to the **Orders** canonical-systems governance node (`LETBUYY_CANONICAL_SYSTEMS.md L190`: "the one server-side order RPC; `*_minor bigint` amounts") | ✅ |
| Architecture | `graphify explain "proxy"` | `proxy()` code node at `apps/app-marketplace/src/proxy.ts L15`, degree 3 | ✅ |
| Architecture | `graphify path "checkout" "gift_card"` | 3-hop path (Razorpay checkout screen → flutter/material → gift-cards screen); ambiguity warning surfaced | ✅ (with warning) |
| Payments | `graphify explain "complete_order_refund"` | governed money-RPC node present in graph | ✅ |
| OAuth | `graphify explain "identity-platform"` | resolves to the ES256 merchant identity app cluster | ✅ |
| RLS | `graphify explain "site_id"` | resolves across tenant-scoped tables/queries | ✅ |
| Theme Engine | `graphify explain "LiquidRenderer"` | resolves to `packages/theme-engine/src/theme-renderer.ts` | ✅ |
| Marketplace | `graphify explain "app-marketplace"` | resolves to the frozen marketplace app cluster | ✅ |

## Known limitations surfaced by validation
1. **SQL RPCs are not individual nodes.** `graphify explain "issue_gift_card"` / `"restore_gift_card_on_refund"` → "No node matching". Graphify's tree-sitter extraction indexes code symbols, not SQL function bodies. **Authoritative source for the data/money model remains `database/supabase/migrations/` + the `canonical-ledger-only` / `sequential-migration` validators** — do not rely on the graph for SQL-level truth.
2. **Ambiguous matches** on short tokens (e.g. `checkout`) emit a top-vs-runner-up warning; prefer fully-qualified symbol names.
3. **No `graph.html`** — 52k nodes exceed the 5,000-node HTML-viz limit; use the CLI queries or raise `GRAPHIFY_VIZ_NODE_LIMIT`.

## Reproduce
```bash
uv tool install graphifyy      # isolated
graphify update .              # rebuild graph (LLM-free)
graphify explain "<symbol>"    # query
```
Graph artifacts are gitignored; rebuild locally as needed.
