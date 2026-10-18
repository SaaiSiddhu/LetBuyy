# N1.3 — owner session-policy decision — 14 October 2026

In the current native Goal, the owner answered the outstanding lifetime choice: **“Retain 7-day legacy compatibility for V1.”**

Preserve the current seven-day legacy store-customer compatibility session. This resolves the V1 compatibility-duration choice; it does not authorize extending shorter Gateway transport credentials, changing canonical realm lifetimes, adding another issuer, or performing hosted drain/retirement/cutover. Identity remains the sole asymmetric issuer, with Gateway verify-only. Those separate lifecycle, revocation, recovery, ownership and hosted gates remain N1.3 work.

The existing source already declares `LETBUYY_CUSTOMER_SESSION_TTL_SECONDS` as seven days in `packages/auth-core/src/index.ts`; `packages/auth-core/src/customer-session.ts` separately declares the thirty-minute Gateway transport lifetime. No lifetime was changed to record this decision. Verify both distinct paths and approved compatibility behavior during N1.3, including restart, expiry, revocation and realm-scoped logout.

Evidence: direct user reply in chat `01a13a26-2c7f-7672-80e1-a0d0861e4a44`; the active programme ledger records the decision. No independent-review or acceptance signature is implied.
