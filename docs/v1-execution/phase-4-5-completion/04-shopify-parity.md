# 04 — Shopify Parity (reasoned mapping, not a fabricated benchmark)

**Honest scope note:** this is a *reasoned* workflow-coverage mapping against Shopify's core merchant admin, derived from the verified LetBuyy capability audit — **not** an exhaustive feature-by-feature Shopify crawl. Shopify is the benchmark, not the target; LetBuyy is India-first V1, intentionally narrower. Treat the % as an engineering estimate.

| Domain | Core Shopify workflow | LetBuyy coverage | Parity (est.) |
|---|---|---|---|
| Products | CRUD, variants, media, SEO, status, bulk | CRUD/variants/media/SEO/status real; bulk publish/draft; delete-button + bulk-delete UI missing | ~70% |
| Collections | Manual + smart (rules) | Manual CRUD (edit/delete proxy now exists); **smart/rules absent** | ~55% |
| Inventory | Levels, history, transfers, POs, multi-location | Levels + adjust real; history/transfers/POs not surfaced (stubs) | ~40% |
| Orders | Detail, timeline, fulfill, returns, refund | List + status machine + step-up refund real; detail page/timeline/returns UI missing | ~60% |
| Customers | Detail, history, addresses, notes, segments | **Detail + history + addresses + notes now built (this phase)**; segments/merge/GDPR missing | ~60% |
| Discounts | Codes + automatic + classes | Coupons (%/fixed/free-ship) production-ready; automatic discounts absent | ~70% |
| Analytics | Dashboards, reports, time filters | Revenue/orders/products/customers live; monthly chart now real; conversion/traffic telemetry-gated | ~60% |
| Domains | Connect, verify, SSL | Real DNS/SSL/routing (deploy-gated) — strong | ~85% |
| Shipping | Zones, rates, profiles, carriers | Zones + rate add/edit(now)/delete; profiles + live carrier deferred | ~70% |
| Settings | Store/tax/policies/checkout/payments | Broad + real; email page + payment toggles + custom-data gaps | ~80% |
| Staff | Roles, permissions, enforcement | Management real; **enforcement absent** (security gap) | ~50% |
| Marketing | SEO, reviews, email, abandoned cart | Reviews + SEO real; campaign UI + abandoned-cart worker missing | ~60% |

**Estimated overall merchant-admin Shopify parity: ~62%** (core commerce workflows present and backend-strong; depth — bulk editors, automation/Flow, advanced reporting, B2B/markets — is out of V1 scope). Justified gaps implemented this phase: the customer detail workflow (a baseline Shopify merchant expectation that was entirely missing) + shipping rate editing.
