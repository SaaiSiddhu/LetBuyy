# 09 — Security Hardening

**Readiness: ~90% code.** Controls launch-grade; a few hardening items + the WIP registry drift remain.
Detailed audit: `docs/v1-execution/pre-launch-wave/11-security.md`.

## Verified (validators green this phase)
Auth issuer separation (ES256 merchant / HS256 customer, alg-whitelisted) · session/cookie (HttpOnly+Secure, weak-key guard) · CSRF (double-submit + constant-time) · webhook/queue HMAC · step-up (refund/payout) · rate-limit + Turnstile. `session-security-validator` PASS; `lb13-security-trio` + `lb34-stepup` pass.

## Open (documented — not blind-applied; high blast radius / needs verification)
- **FORCE RLS on PII tables** (`notifications`, `wishlists`, `theme_reviews`, `theme_purchases`, `notification_preferences`): ENABLE RLS but no FORCE + `USING(true)` → a service-role query bypassing the GUC could read across users (PII, not money). **NOT applied blind:** the gateway uses service-role for legitimate cross-cutting reads of some of these; adding FORCE RLS without verifying every access path sets the tenant GUC could break notifications/wishlist reads. Needs a policy review + staging verification.
- **`INTERNAL_AUTH_LEGACY_ACCEPT` default ON** — must flip `=false` after H2 rotation (H5).
- **E2** refund step-up gate (see `02-refund-hardening.md`).
- **tenant-isolation registry drift** (pre-existing WIP) — actual RLS passes the red-team suite (`tenant-redteam-postgres`); the validator red is a stale generated artifact. Fix = run `generate-tenant-table-registry.mjs`.

**Verdict:** core security is launch-grade; the open items are hardening + a WIP regen, not active exploitable gaps on the audited paths.
