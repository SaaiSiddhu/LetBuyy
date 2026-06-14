# LCIS v2 — Security Intelligence (Phase 7)

The security graph: flows + the enforcing validators. Query: `pnpm graph:intel {tenant,payment,table,owner}` · `/api/{domain?key=security,table,owner}` · `/graph-security`.

## Flows
| Flow | Anchors | Enforcement |
|------|---------|-------------|
| **Auth (customer)** | `issueCustomerSession` (HS256, `CUSTOMER_SESSION_SECRET`) | `identity-sole-issuer-validator` |
| **Auth (merchant)** | identity-platform (ES256 + JWKS) | same |
| **JWT** | token verify on protected routes | — |
| **OAuth / PKCE** | developer-portal (frozen) | ARB to activate |
| **Tenant** | `verifySiteOwnership` + `site_id`; 255 tenant tables, 235 RLS | `rls-force-coverage`, `no-public-using-true` |
| **Payment** | 34 money RPCs (SD + idempotent + lock) | `canonical-ledger-only` |
| **HMAC** | webhook signatures, `signQueueTenantEnvelope`, Razorpay verify | `step-up-crypto` |
| **Secrets** | 19 production secrets via `wrangler secret put` | no plaintext in repo |

## Security graph data (real)
- **3,805 security-domain nodes / 756 files** (`/api/domain?key=security`).
- **651 RLS policies** across **394 RLS-enabled tables** (44 FORCE).
- **128 SECURITY DEFINER functions** (money mutations behind them).
- **19 production secrets** required; **migrate gate** before deploy.

## Deterministic backstop (authoritative, all green)
```
canonical-ledger-only · rls-force-coverage · no-public-using-true · no-blanket-service-role · identity-sole-issuer
```

## Candidates to verify (heuristic — not violations)
- 20 tenant tables without a regex-detected RLS enable (validator passes → service-role/ledger or pattern-not-detected).
- 34 `USING(true)` policies (validator passes → service-role-scoped).

## How to use
"What's the auth/tenant/payment surface, and is invariant X enforced?" → `/graph-security` runs the graph queries + the deterministic validators, then reports — no full scan.
