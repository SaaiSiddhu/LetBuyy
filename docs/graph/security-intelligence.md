# Security Intelligence

Graph-driven security surface. **3,805 nodes across 756 files** (attention score 51). Live: **Security** tab or `curl /api/domain?key=security`. Drive a full audit with `/graph-security`.

## Surfaces & how to find them in the graph
| Surface | Graph anchors | Code |
|---------|---------------|------|
| **Payments** | `create_checkout_order`, `complete_order_refund`, `razorpay_signature` | see payment-intelligence.md |
| **Auth / JWT** | `issueCustomerSession`, `identity-platform`, `step-up` | see identity-intelligence.md |
| **RLS** | tenant tables, policies | `database/supabase/migrations/` |
| **Webhooks (HMAC)** | `webhook-service`, `hmacSha256Hex`, `signQueueTenantEnvelope` | `services/webhook-service`, `lib/crypto.ts` |
| **Turnstile** | registration/login guard | `customer-registration.ts` |
| **Rate limits** | rate-limit middleware | gateway middleware |
| **Secrets** | `*_SECRET`, `*_KEY` env reads | gateway env binding |

## Deterministic backstop (authoritative)
The graph helps you *find* surfaces; these validators *enforce* them (all currently PASS):
```bash
node scripts/validators/canonical-ledger-only-validator.mjs   # money RPC-only
node scripts/validators/rls-force-coverage-validator.mjs       # RLS forced
node scripts/validators/no-public-using-true-validator.mjs     # no public USING(true)
node scripts/validators/no-blanket-service-role-validator.mjs  # service-role scoped
node scripts/validators/identity-sole-issuer-validator.mjs     # single issuer
```

## Hunt list (untrusted input → sink)
Missing ownership/tenant check on a new route · client-trusted amount/order_id/site_id · unsigned webhook acceptance · plaintext secret in code · RLS gap on a new tenant table · issuer crossover · gift-card code enumeration. The graph's neighbor edges reveal which routes reach which money/tenant nodes.
