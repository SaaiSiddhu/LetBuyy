# Phase 1 — Regression Report (Stream F)

**Status:** ✅ No Phase-1 regressions. 156/156 launch contracts pass; the single theme-engine failure pre-dates HEAD.

## Full launch contract suite (all domains)
`node --test tests/launch/*.test.mjs`

```
# tests 156
# pass  156
# fail  0
```

This suite is the repo's source-of-truth contract layer and exercises the domains the mission lists:

| Domain | Covering launch tests | Result |
|---|---|---|
| Products / Variants | lb5-variants | ✅ |
| Collections | lb6-collections | ✅ |
| Orders / Refund backend | lb3-refund-backend, lb11-refund-restore | ✅ |
| Customers / Auth | lb12-registration, lb9-auth (liquid), lb13-security-trio | ✅ |
| Checkout / Cart | lb-liquid-l8-cart, lb7-shipping-gst | ✅ |
| Themes / Storefront | lb1-storefront-middleware, lb2-storefront-providers, lb8-announcement-bar, lb-liquid-l1..l14 | ✅ |
| Auth / Step-up | lb34-stepup-frontend, lb13-security-trio | ✅ |
| Emails | lb10-order-emails, lb10-dispatch | ✅ |
| Shipping + GST | lb7-shipping-gst (28) | ✅ |
| Discounts / Gift cards | lb11-giftcards, lb7 coupon bogo guard | ✅ |

## Typecheck (build integrity)
| Package | Command | Result |
|---|---|---|
| api-gateway | `tsc --noEmit` | ✅ clean (exit 0) — covers orders.ts, order-risk.ts, storefront.ts |
| storefront-runtime | `tsc --noEmit` | ✅ clean (exit 0) — covers announcement-bar.tsx, renderer-registry.tsx, account-bottom-sheet.tsx |

## Theme-engine sweep
`node --test tests/theme-engine/*.test.mjs` → **31 pass / 1 fail**.

The one failure — *"storefront resolver and composition engine render full Liquid documents with Liquid chrome"* (`storefront-liquid-runtime.test.mjs`) — is **PRE-EXISTING, not Phase 1**:
- It asserts `composition-engine.tsx` contains `result.liquid.layoutHtml`.
- That string is absent in **HEAD's** `composition-engine.tsx` (`git show HEAD:… | grep -c layoutHtml` → **0**) — i.e., the test was already failing before any branch work.
- `composition-engine.tsx` is independently WIP-modified (` M`) and was **never touched by Phase 1**. The Phase-1 renderer-registry edit cannot add strings to composition-engine.tsx.

## Conclusion
Phase 1's edits (3 gateway files, 3 storefront files, 1 migration, 3 test files) broke **zero** contracts across products, collections, orders, customers, checkout, themes, auth, emails, shipping, GST, and discounts. The only red signals in the tree are pre-existing (see `07-governance-report.md`).
