# 11 — Security (Stream K)

**Readiness: ~90% code-level.** Core controls are Production Ready; a few hardening items + the WIP registry drift remain.

## Production Ready (verified)
- **Auth issuer separation:** merchant ES256/EdDSA (JWKS) vs customer HS256; alg whitelist `['ES256','EdDSA']` — HS256 cannot pass as a merchant token. ✅
- **Session/cookie:** HttpOnly+Secure (prod-gated), CSRF cookie SameSite=strict, weak-key guard throws in prod, platform vs storefront realm separation. ✅
- **CSRF:** double-submit + `timingSafeEqualText`; gates all mutating methods. ✅
- **Webhook/queue HMAC:** `signQueueTenantEnvelope` (HMAC-SHA-256), Razorpay `timingSafeEqualHex`, internal keyring + JTI replay. ✅
- **Step-up (refund/payout):** `lb-stepup-v1` HMAC, 10-min window, per-action, ≥32-char secret; StepUpDialog wired. ✅ (lb34 7/7)
- **Rate-limit + Turnstile:** Upstash sliding-window; Turnstile bypass only when secret absent (local). ✅ (lb13 4/4)

## Risk register
| Sev | Finding |
|---|---|
| MED | `notifications`, `wishlists`, `theme_reviews`, `theme_purchases`, `notification_preferences` have ENABLE RLS but **no FORCE RLS** + `USING(true)` — a service-role query bypassing the GUC could read across users (PII, not money). Needs FORCE RLS. |
| MED | `INTERNAL_AUTH_LEGACY_ACCEPT` defaults ON — must be flipped `=false` after H2 rotation, else a leaked `INTERNAL_API_SECRET` is a full internal bypass. |
| MED (WIP) | `tenant-tables.registry.ts` drift → `tenant-isolation-validator` FAIL. **Pre-existing WIP** (schema migrations added tables after the last generator run); the actual RLS passes the red-team suite (`tenant-redteam-postgres`). Fix = run `generate-tenant-table-registry.mjs`. |
| OPS | Platform-console magic-link login hard-blocked until H6 (Resend) — operational blocker, not a flaw. |
| E2 (HIGH) | Refund step-up gate missing on orders/returns refund-complete routes (see `05-refunds.md`). |

## Verdict
Security controls are **launch-grade** at the code level. Pre-launch must: add FORCE RLS to the PII tables, plan the `INTERNAL_AUTH_LEGACY_ACCEPT` flip (H5), close E2, and regenerate the tenant registry. The actual tenant isolation (RLS) is sound (red-team passes); the validator red is a stale generated artifact.
