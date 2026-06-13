# LetBuyy Graphify Query Library

> Curated `graphify` queries over the LetBuyy code graph (`graphify-out/graph.json`). Run from repo root after `graphify update .`.
> Placed under `docs/ai-infrastructure/` (not repo root) because the governance `whole-repo-end-state` validator allow-lists root markdown to 9 files.
> Commands: `graphify explain "X"` · `graphify path "A" "B"` · `graphify diagnose multigraph`.

## Architecture
1. `graphify explain "api-gateway"`
2. `graphify explain "proxy"`
3. `graphify explain "create_checkout_order"`
4. `graphify path "storefront-runtime" "api-gateway"`
5. `graphify path "merchant-control-plane" "api-gateway"`
6. `graphify explain "queue-workers"`
7. `graphify explain "Runtime Authority"`
8. `graphify path "checkout" "ledger"`

## Auth & Identity
9. `graphify explain "issueCustomerSession"`
10. `graphify explain "verifyCustomerPassword"`
11. `graphify explain "CUSTOMER_SESSION_SECRET"`
12. `graphify explain "createSession"`
13. `graphify path "customer login" "session"`
14. `graphify explain "registerCustomer"`
15. `graphify explain "auth-core"`

## OAuth / Issuer
16. `graphify explain "ES256"`
17. `graphify explain "identity-platform"`
18. `graphify explain "LETBUYY_IDENTITY_PUBLIC_JWKS"`
19. `graphify path "merchant login" "identity-platform"`
20. `graphify explain "step-up"`

## RLS / Tenancy
21. `graphify explain "site_id"`
22. `graphify explain "resolveTenantContextForOrder"`
23. `graphify explain "verifySiteOwnership"`
24. `graphify explain "getSupabaseAdmin"`
25. `graphify path "order" "site"`

## Payments
26. `graphify explain "complete_order_refund"`
27. `graphify explain "confirm_order_payment_with_ledger"`
28. `graphify explain "post_settlement_ledger_transaction"`
29. `graphify explain "payment_transactions"`
30. `graphify path "payment" "ledger"`

## Razorpay
31. `graphify explain "createRazorpayPaymentProvider"`
32. `graphify explain "razorpay_signature"`
33. `graphify explain "RAZORPAY_KEY_SECRET"`
34. `graphify explain "verifyPayment"`

## COD
35. `graphify explain "cod"`
36. `graphify explain "cod_reconciliation_entries"`
37. `graphify path "cod" "order"`

## GST
38. `graphify explain "gstin"`
39. `graphify explain "tax_amount"`
40. `graphify explain "gst"`

## Gift Cards
41. `graphify explain "gift_card_accounts"`
42. `graphify explain "generateGiftCardCodeFromBytes"`
43. `graphify explain "gift_card_available_balance"`
44. `graphify path "gift_card" "checkout"`

## Webhooks
45. `graphify explain "webhook-service"`
46. `graphify explain "hmacSha256Hex"`
47. `graphify explain "signQueueTenantEnvelope"`

## Theme Engine
48. `graphify explain "LiquidRenderer"`
49. `graphify explain "JsonContractThemeRenderer"`
50. `graphify explain "sanitizeRenderedHtml"`
51. `graphify explain "theme-engine"`
52. `graphify path "theme" "storefront"`

## Marketplace / Developer Portal
53. `graphify explain "app-marketplace"`
54. `graphify explain "theme-marketplace"`
55. `graphify explain "developer-portal"`

## Storefront / Email
56. `graphify explain "store-service"`
57. `graphify explain "enqueueOrderConfirmationEmail"`
58. `graphify explain "enqueueGiftCardIssuedEmail"`
59. `graphify explain "isTransactionalEmailJob"`

## Graph health
60. `graphify diagnose multigraph --json`
