# Phase 5 — Security Graph

**Security-control subgraph. Node/degree from `graph.json` (code); control behavior from code-verified audit (file:line).**

| Control | Graph anchor (node, degree) | Verified behavior |
|---|---|---|
| JWT (merchant) | `identity-session-verifier.ts`, `identity-issued-session.ts` | ES256/EdDSA only; JWKS-verified; rejects non-asymmetric alg twice (`:57–59,95–97`) |
| Customer session | `issueCustomerSession` / `customer-session.ts` (auth-core deg 140 on index) | HS256, `CUSTOMER_SESSION_SECRET`, separate realm |
| OAuth / PKCE | `oidc-disabled.ts` | 501 skeleton, `FEATURE_IDENTITY_PROVIDER` off — **no live OAuth/PKCE in V1** |
| Turnstile | `middleware/security.ts:219–249` | fail-closed (false without secret); gates register/login |
| RLS | (SQL — ungraphed) | forced in 18 migrations; `app_tenant` role + RT-1..9 test (mig 164) |
| Ownership verification | **`resolveOwnedStoreId()` deg 171**, `verifySiteOwnership` | top-degree hub; throws `ForbiddenError` for non-owner |
| Webhook HMAC | `webhook-service/src/index.ts` (175 nodes) | all providers `timingSafeEqual` + dedupe |
| Step-up | `security-controls.ts:126–243` | real HMAC; rejects placeholder/<32-char secrets |
| Session mgmt | `validate_and_rotate_merchant_session` (`merchant-session.ts`) | opaque DB session + rotation |
| Tenant isolation | **`getSupabaseAdmin()` deg 170** + `createTenantGuardedSupabaseClient` | top-degree hub; Proxy rejects untenanted registry queries |

## What the centrality tells us
The two highest-degree *security* nodes are **`resolveOwnedStoreId()` (171)** and **`getSupabaseAdmin()` (170)** — both in the top 20 of the entire 28k-node code graph. That is structurally healthy: ownership resolution and the tenant-guarded DB client are *pervasively depended upon*, which is exactly what you want for cross-cutting security primitives (every tenant write routes through them rather than around them).

## Security keyword subgraph
129 code nodes match security terms (verifySiteOwnership/step-up/hmac/turnstile/jwks/es256), total degree 412 — concentrated in `services/api-gateway/src/lib` and `middleware`, and `packages/auth-core`. No security primitive is an orphan; all are wired into call paths.

## Graph blind spots for security
- **RLS policies are SQL → ungraphed.** The single most important tenant-isolation control (forced RLS + GUC) is invisible to Graphify. Its authority is the migrations + the `rls-force-coverage` validator, not the graph.
- **Edge case:** the graph shows *structural* dependency on the guards but cannot prove they are *invoked before* a write on every path — that is what the route-by-route code audit (Phase C of the certification: 0 ownership gaps in 87 routes) establishes. Use the graph to find candidates (any route node not reaching `verifySiteOwnership`), the audit to confirm.

## Recommended graph query (once MCP wired)
`graphify path "<any mutating route>" "verifySiteOwnership"` for every route node — a missing path is a candidate ownership gap. This operationalizes the tenant-isolation audit as a repeatable graph query (Phase 15 `security-flow` pack).
